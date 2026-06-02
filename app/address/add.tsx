import { useDeliveryStatus } from '@/components/ui/EstimatedDeliveryTime';
import { SearchIcon } from '@/components/ui/SearchIcon';
import { Colors, Fonts } from '@/constants/theme';
import { getAppVersionForApi } from '@/constants/versionConfig';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appConfigService } from '@/services/appConfigService';

const GOOGLE_API_KEY = 'PLACEHOLDER_GOOGLE_MAPS_KEY';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LocationData {
    formattedAddress: string;
    latitude: number;
    longitude: number;
    city?: string;
    state?: string;
    pincode?: string;
    address1?: string;
}

// --- Helper Functions (Kiddo Style) ---

const searchPlaces = async (query: string) => {
    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
                query
            )}&key=${GOOGLE_API_KEY}&components=country:in`
        );
        const data = await response.json();
        if (data.status === 'OK' && data.predictions) {
            return data.predictions;
        }
        return [];
    } catch (error) {
        console.log('Search Error:', error);
        return [];
    }
};

const getPlaceDetails = async (placeId: string) => {
    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address,address_components&key=${GOOGLE_API_KEY}`
        );
        const data = await response.json();
        if (data.status === 'OK' && data.result) {
            return data.result;
        }
        return null;
    } catch (error) {
        console.log('Place Details Error:', error);
        return null;
    }
};

export default function MapAddressScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const params = useLocalSearchParams<{ returnToCart?: string; returnToHome?: string }>();
    const mapRef = useRef<MapView>(null);

    // Map State
    const [initialRegion, setInitialRegion] = useState<Region>({
        latitude: 12.9716, // Bangalore
        longitude: 77.5946,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
    });
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);
    const [isMapMoving, setIsMapMoving] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Timeout for map drag debounce
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Delivery zone + ETA from backend POST /eta (`isServiceable`).
    const { deliveryTime, isServiceable, loading: etaLoading } = useDeliveryStatus(
        selectedLocation?.latitude,
        selectedLocation?.longitude
    );

    useEffect(() => {
        void appConfigService.loadAppConfig(false, {
            phone: user?.phone ?? undefined,
            customerId:
                (user?.customerId ?? user?.id) != null ? String(user?.customerId ?? user?.id) : undefined,
            appVersion: getAppVersionForApi(),
            deviceType: Platform.OS,
        });
    }, [user?.phone, user?.customerId, user?.id]);

    useEffect(() => {
        (async () => {
            try {
                // Check if Location is available
                if (!Location) {
                    setMapError('Location services are not available');
                    return;
                }

                let { status } = await Location.getForegroundPermissionsAsync();
                if (status !== 'granted') {
                    status = (await Location.requestForegroundPermissionsAsync()).status;
                }
                if (status !== 'granted') {
                    console.log('Location permission not granted');
                    setMapError('Location permission is required to use this feature');
                    return;
                }

                // Industry best practice: Try last known position first (instant)
                let location = await Location.getLastKnownPositionAsync();
                
                // If no cached location, get fresh one with timeout
                if (!location || !location.coords) {
                    location = await Promise.race([
                        Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Low,
                        }),
                        new Promise<null>((_, reject) => 
                            setTimeout(() => reject(new Error('Location timeout')), 8000)
                        ),
                    ]) as any;
                }
                
                if (!location?.coords) {
                    setMapError('Could not get location coordinates');
                    return;
                }

                const newRegion = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                };

                setInitialRegion(newRegion);
                
                // Start geocoding immediately
                performReverseGeocode(newRegion.latitude, newRegion.longitude);
                
                // Animate map after a short delay to ensure MapView is mounted
                setTimeout(() => {
                    try {
                        mapRef.current?.animateToRegion(newRegion, 1000);
                    } catch (error) {
                        console.error('Error animating to region:', error);
                    }
                }, 500);
            } catch (error: any) {
                console.error('Error getting location:', error);
                setMapError(error?.message || 'Could not get your location. Please try again.');
            }
        })();
    }, []);

    const performReverseGeocode = async (latitude: number, longitude: number) => {
        setLoadingAddress(true);
        
        try {
            // Use AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`,
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Geocoding failed: ${response.status}`);
            }
            
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const result = data.results[0];
                const addressComponents = result.address_components;
                const formattedAddress = result.formatted_address;

                let streetNumber = '';
                let route = '';
                let newArea = '';
                let newCity = '';
                let newState = '';
                let newPincode = '';
                
                // Collect specific building/society/sector components
                const granularParts: string[] = [];

                addressComponents.forEach((component: any) => {
                    const types = component.types;
                    
                    // Building / Apartment / Society
                    if (types.includes('premise') || types.includes('subpremise') || types.includes('point_of_interest')) {
                        if (!granularParts.includes(component.long_name)) granularParts.push(component.long_name);
                    }
                    
                    // Street
                    if (types.includes('route')) {
                        if (!granularParts.includes(component.long_name)) granularParts.push(component.long_name);
                    }

                    // Sector / Block / Neighborhood
                    if (types.includes('neighborhood') || types.includes('sublocality_level_3') || types.includes('sublocality_level_2')) {
                        if (!granularParts.includes(component.long_name)) granularParts.push(component.long_name);
                    }
                    
                    // General Area
                    if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
                        if (!newArea) newArea = component.long_name;
                        if (!granularParts.includes(component.long_name)) granularParts.push(component.long_name);
                    }
                    
                    if (types.includes('street_number')) streetNumber = component.long_name;
                    
                    if (types.includes('locality')) {
                        newCity = component.long_name;
                    } else if (!newCity && (types.includes('administrative_area_level_2') || types.includes('administrative_area_level_3'))) {
                        newCity = component.long_name;
                    }
                    if (types.includes('administrative_area_level_1')) newState = component.long_name;
                    if (types.includes('postal_code')) newPincode = component.long_name;
                });

                const locData = {
                    formattedAddress,
                    latitude,
                    longitude,
                    area: newArea,
                    city: newCity,
                    state: newState,
                    pincode: newPincode,
                    address1: `${streetNumber} ${route}`.trim(),
                    buildingAndSector: granularParts.join(', '),
                };

                setSelectedLocation(locData);
                setMapError(null);
            } else {
                console.log('Geocoding status:', data.status);
                setMapError('Could not find address for this location.');
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('Geocoding timeout');
                setMapError('Request timed out. Please check your internet connection.');
            } else {
                console.error('Reverse geocoding error:', error);
                setMapError(error?.message || 'Failed to get address. Please try again.');
            }
        } finally {
            setLoadingAddress(false);
        }
    };

    const onRegionChange = () => {
        if (!isMapMoving) {
            setIsMapMoving(true);
        }
    };

    const onRegionChangeComplete = (newRegion: Region) => {
        setIsMapMoving(false);
        // Debounce reverse geocoding on drag (reduced delay for faster response)
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            performReverseGeocode(newRegion.latitude, newRegion.longitude);
        }, 500); // Reduced from 800ms to 500ms
    };

    const handleSearchChange = async (text: string) => {
        setSearchQuery(text);
        if (text.length > 2) {
            setIsSearching(true);
            const results = await searchPlaces(text);
            setSearchResults(results);
            setIsSearching(false);
        } else {
            setSearchResults([]);
        }
    };

    const handleSelectSearchResult = async (placeId: string, description: string) => {
        setSearchQuery(description);
        setSearchResults([]);

        const details = await getPlaceDetails(placeId);
        if (details && details.geometry) {
            const { lat, lng } = details.geometry.location;
            const newRegion = {
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };
            mapRef.current?.animateToRegion(newRegion, 1000);

            // Trigger geocode logic immediately
            performReverseGeocode(lat, lng);
        }
    };

    const handleConfirmLocation = () => {
        if (!selectedLocation) {
            Alert.alert('Selection Required', 'Please wait for the location to be identified.');
            return;
        }

        try {
            const locationDataString = JSON.stringify(selectedLocation);
            router.push({
                pathname: '/address/form',
                params: {
                    locationData: locationDataString,
                    ...(params.returnToCart === '1' && { returnToCart: '1' }),
                    ...(params.returnToHome === '1' && { returnToHome: '1' }),
                },
            });
        } catch (error) {
            console.error('Error serializing location data:', error);
            Alert.alert('Error', 'Failed to process location data. Please try again.');
        }
    };

    const handleFindMe = async () => {
        try {
            setLoadingAddress(true);
            setMapError(null);

            // Check permission first; only request if not already granted
            let { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                status = (await Location.requestForegroundPermissionsAsync()).status;
            }
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant location permission to use this feature.');
                setLoadingAddress(false);
                return;
            }

            // Industry best practice: Try to get last known position first (instant)
            let location = await Location.getLastKnownPositionAsync();

            // If no cached location or it's too old (> 30 seconds), get fresh location
            if (!location || !location.coords) {
                // Get fresh location with timeout
                location = await Promise.race([
                    Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Low,
                    }),
                    new Promise<null>((_, reject) => 
                        setTimeout(() => reject(new Error('Location timeout')), 8000)
                    ),
                ]) as any;
            }

            if (!location?.coords) {
                Alert.alert('Error', 'Could not get location coordinates.');
                setLoadingAddress(false);
                return;
            }

            const newRegion = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };

            // Update initial region
            setInitialRegion(newRegion);

            // Start geocoding immediately (don't wait for map animation)
            performReverseGeocode(newRegion.latitude, newRegion.longitude);

            // Animate map to location (non-blocking)
            if (mapRef.current) {
                try {
                    mapRef.current.animateToRegion(newRegion, 1000);
                } catch (mapError) {
                    console.error('Error animating map:', mapError);
                    // Continue even if animation fails
                }
            }

            // If we used cached location, fetch fresh one in background and update
            if (location.timestamp) {
                const age = Date.now() - location.timestamp;
                if (age > 5000) { // If cached location is > 5 seconds old
                    Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Low,
                    })
                        .then((freshLocation) => {
                            if (freshLocation?.coords) {
                                const freshRegion = {
                                    latitude: freshLocation.coords.latitude,
                                    longitude: freshLocation.coords.longitude,
                                    latitudeDelta: 0.005,
                                    longitudeDelta: 0.005,
                                };
                                
                                // Only update if location changed significantly (> 50 meters)
                                const distance = Math.sqrt(
                                    Math.pow(freshLocation.coords.latitude - newRegion.latitude, 2) +
                                    Math.pow(freshLocation.coords.longitude - newRegion.longitude, 2)
                                ) * 111000; // Convert to meters
                                
                                if (distance > 50) {
                                    setInitialRegion(freshRegion);
                                    performReverseGeocode(freshRegion.latitude, freshRegion.longitude);
                                    if (mapRef.current) {
                                        mapRef.current.animateToRegion(freshRegion, 1000);
                                    }
                                }
                            }
                        })
                        .catch((error) => {
                            console.log('Background location update failed:', error);
                            // Silent fail - we already have a location
                        });
                }
            }
        } catch (error: any) {
            console.error('Error finding location:', error);
            setLoadingAddress(false);
            
            if (error?.message?.includes('timeout')) {
                Alert.alert('Timeout', 'Location request timed out. Please try again or select location manually.');
            } else {
                Alert.alert('Error', error?.message || 'Could not fetch current location. Please try again.');
            }
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View style={styles.searchContainer}>
                    <SearchIcon size={20} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for an area"
                        placeholderTextColor={Colors.textSecondary}
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => {
                            setSearchQuery('');
                            setSearchResults([]);
                        }} style={{ padding: 4 }}>
                            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.placeholder} />
            </View>

            {/* Search Results Dropdown - Relative Position (Kiddo Style) */}
            {searchResults.length > 0 && (
                <View style={[styles.resultsContainer]}>
                    <ScrollView
                        style={styles.resultsScrollView}
                        keyboardShouldPersistTaps="handled"
                    >
                        {searchResults.map((result) => (
                            <TouchableOpacity
                                key={result.place_id}
                                style={styles.resultItem}
                                onPress={() => handleSelectSearchResult(result.place_id, result.description)}
                            >
                                <Ionicons name="location-outline" size={20} color={Colors.textSecondary} />
                                <View style={styles.resultTextContainer}>
                                    <Text style={styles.resultMainText}>
                                        {result.structured_formatting?.main_text || result.description}
                                    </Text>
                                    <Text style={styles.resultSubText} numberOfLines={1}>
                                        {result.structured_formatting?.secondary_text || ''}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Map */}
            <View style={styles.mapContainer}>
                {mapError ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{mapError}</Text>
                        <TouchableOpacity 
                            style={styles.retryButton} 
                            onPress={() => {
                                setMapError(null);
                                handleFindMe();
                            }}
                        >
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={initialRegion}
                    onRegionChange={onRegionChange}
                    onRegionChangeComplete={onRegionChangeComplete}
                    showsUserLocation={true}
                    showsMyLocationButton={true}
                    onMapReady={() => {
                        // Ensure map is ready before operations
                        if (mapRef.current) {
                                try {
                            mapRef.current.animateToRegion(initialRegion, 1000);
                                } catch (error) {
                                    console.error('Error animating map:', error);
                                }
                        }
                    }}
                />
                )}

                {/* Fixed Center Pin */}
                <View style={styles.markerFixed}>
                    <View style={styles.customMarker}>
                        <View style={styles.markerPin}>
                            <View style={styles.markerPinHead} />
                            <View style={styles.markerPinPoint} />
                        </View>
                    </View>
                </View>
            </View>

            {/* Bottom Sheet */}
            <View style={styles.bottomSheet}>
                <View style={styles.bottomSheetContent}>
                    <View style={styles.addressRow}>
                        <View style={styles.addressDetails}>
                            <Text style={styles.addressCode}>
                                {loadingAddress ? 'Locating...' : (selectedLocation?.city || selectedLocation?.formattedAddress?.split(',')[0] || 'Select Location')}
                            </Text>
                            <View style={styles.addressFullRow}>
                            <Text style={styles.addressFull} numberOfLines={2}>
                                {loadingAddress ? 'Fetching address details...' : (selectedLocation?.formattedAddress || 'Drag map to place pin')}
                            </Text>
                                {/* Find Me button on the right */}
                                <TouchableOpacity style={styles.findMeButtonSmall} onPress={handleFindMe}>
                                    <Ionicons name="paper-plane" size={16} color={Colors.primary} />
                                    <Text style={styles.findMeTextSmall}>Find Me</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.confirmButton, 
                            (!selectedLocation || loadingAddress || isMapMoving || etaLoading || !isServiceable) && styles.disabledButton
                        ]}
                        onPress={handleConfirmLocation}
                        disabled={!selectedLocation || loadingAddress || isMapMoving || etaLoading || !isServiceable}
                    >
                        {loadingAddress || isMapMoving ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.confirmButtonText}>
                                {etaLoading
                                    ? 'Checking delivery area...'
                                    : !isServiceable
                                        ? 'Not Serviceable Yet'
                                        : 'Confirm Location'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        zIndex: 20, // High zIndex for header
    },
    backButton: {
        padding: 4,
        marginRight: 10,
    },
    placeholder: {
        width: 10,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 45, // Constant height
        marginRight: 10,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#000',
        fontFamily: Fonts.Regular,
        fontSize: 14,
        padding: 0,
        height: '100%', // Take full height of container
    },
    // Custom Search Results List
    resultsContainer: {
        position: 'relative',
        left: 0,
        right: 0,
        backgroundColor: '#FFF',
        zIndex: 50, // Higher than map
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
        maxHeight: 250,
        paddingTop: 8, // Little padding at top of list
        overflow: 'hidden', // Fix background showing through corners
    },
    resultsScrollView: {
        maxHeight: 250,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    resultTextContainer: {
        marginLeft: 10,
        flex: 1,
    },
    resultMainText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#000',
    },
    resultSubText: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#666',
        marginTop: 2,
    },

    // Map & Markers
    mapContainer: {
        flex: 1,
        position: 'relative',
        zIndex: 1,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    markerFixed: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -20,
        marginTop: -50,
        zIndex: 2,
        pointerEvents: 'none',
    },
    customMarker: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 50,
    },
    markerPin: {
        alignItems: 'center',
    },
    markerPinHead: {
        width: 24,
        height: 24,
        backgroundColor: Colors.primary,
        borderRadius: 12,
        borderWidth: 3,
        borderColor: '#FFF',
        zIndex: 2,
    },
    markerPinPoint: {
        width: 4,
        height: 10,
        backgroundColor: Colors.primary,
        marginTop: -2,
    },

    // Bottom Sheet
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 10,
        zIndex: 10,
    },
    bottomSheetContent: {
        padding: 20,
        paddingBottom: 30, // Extra padding for safe area
    },
    bottomSheetTitle: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        marginBottom: 16,
        color: '#888',
        textTransform: 'uppercase',
    },
    addressRow: {
        marginBottom: 20,
    },
    addressDetails: {
        marginBottom: 10,
    },
    addressHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    addressCode: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#000',
        flex: 1,
    },
    addressFullRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    addressFull: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#666',
        lineHeight: 20,
        flex: 3,
    },
    findMeButtonSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: '#FFF',
        flex: 1,
        gap: 6,
    },
    findMeTextSmall: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    confirmButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 30, // Circular/Pill
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: Fonts.Bold,
    },
    disabledButton: {
        opacity: 0.5,
        backgroundColor: '#9CA3AF', // Greyish color
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#F5F5F5',
    },
    errorText: {
        fontSize: 16,
        fontFamily: Fonts.Regular,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: Fonts.Bold,
    },
});

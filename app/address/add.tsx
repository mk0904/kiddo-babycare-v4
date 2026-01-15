import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Dimensions,
    Alert,
    TextInput,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import MapView, { Region, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import _ from 'lodash';
import { SearchIcon } from '@/components/ui/SearchIcon';

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

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Timeout for map drag debounce
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            let location = await Location.getCurrentPositionAsync({});
            const newRegion = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };

            setInitialRegion(newRegion);
            mapRef.current?.animateToRegion(newRegion, 1000);
            performReverseGeocode(newRegion.latitude, newRegion.longitude);
        })();
    }, []);

    const performReverseGeocode = async (latitude: number, longitude: number) => {
        setLoadingAddress(true);
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const result = data.results[0];
                const addressComponents = result.address_components;
                const formattedAddress = result.formatted_address;

                let streetNumber = '';
                let route = '';
                let newCity = '';
                let newState = '';
                let newPincode = '';

                addressComponents.forEach((component: any) => {
                    const types = component.types;
                    if (types.includes('street_number')) streetNumber = component.long_name;
                    if (types.includes('route')) route = component.long_name;
                    if (types.includes('locality')) newCity = component.long_name;
                    if (types.includes('administrative_area_level_1')) newState = component.long_name;
                    if (types.includes('postal_code')) newPincode = component.long_name;
                });

                const locData = {
                    formattedAddress,
                    latitude,
                    longitude,
                    city: newCity,
                    state: newState,
                    pincode: newPincode,
                    address1: `${streetNumber} ${route}`.trim(),
                };

                setSelectedLocation(locData);
                // We do NOT update searchQuery here to avoid clearing user's manual typing or confusing them
                // setSearchQuery(formattedAddress); 
            }
        } catch (error) {
            console.log('Reverse geocoding error:', error);
        } finally {
            setLoadingAddress(false);
        }
    };

    const onRegionChangeComplete = (newRegion: Region) => {
        // Debounce reverse geocoding on drag
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            performReverseGeocode(newRegion.latitude, newRegion.longitude);
        }, 800);
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

        router.push({
            pathname: '/address/form',
            params: { locationData: JSON.stringify(selectedLocation) }
        });
    };

    const handleFindMe = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const location = await Location.getCurrentPositionAsync({});
            const newRegion = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };

            mapRef.current?.animateToRegion(newRegion, 1000);
        } catch (error) {
            Alert.alert('Error', 'Could not fetch current location.');
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
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    initialRegion={initialRegion}
                    onRegionChangeComplete={onRegionChangeComplete}
                    showsUserLocation={false}
                    showsMyLocationButton={false}
                />

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
                    <Text style={styles.bottomSheetTitle}>Select your delivery location</Text>

                    <View style={styles.addressRow}>
                        <View style={styles.addressDetails}>
                            <Text style={styles.addressCode}>
                                {loadingAddress ? 'Locating...' : (selectedLocation?.city || selectedLocation?.formattedAddress?.split(',')[0] || 'Select Location')}
                            </Text>
                            <Text style={styles.addressFull} numberOfLines={2}>
                                {loadingAddress ? 'Fetching address details...' : (selectedLocation?.formattedAddress || 'Drag map to place pin')}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.findMeButton} onPress={handleFindMe}>
                        <Ionicons name="locate" size={20} color={Colors.primary} />
                        <Text style={styles.findMeText}>Use Current Location</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.confirmButton, (!selectedLocation || loadingAddress) && styles.disabledButton]}
                        onPress={handleConfirmLocation}
                        disabled={!selectedLocation || loadingAddress}
                    >
                        {loadingAddress ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.confirmButtonText}>Confirm Location</Text>
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
    addressCode: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        marginBottom: 4,
        color: '#000',
    },
    addressFull: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#666',
        lineHeight: 20,
    },
    findMeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 30, // Circular/Pill
        borderWidth: 1,
        borderColor: Colors.primary,
        marginBottom: 12,
        backgroundColor: '#FFF',
    },
    findMeText: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: Colors.primary,
        marginLeft: 8,
        textTransform: 'uppercase',
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
        opacity: 0.6,
        backgroundColor: '#CCC',
    },
});

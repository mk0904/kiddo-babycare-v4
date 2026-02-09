import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Fonts } from '@/constants/theme';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { FlexibleGrid, GridItem } from '@/components/ui/FlexibleGrid';
import { useRouter } from 'expo-router';
import { shopifyApi } from '@/services/shopifyApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Collection IDs
const COLLECTION_IDS = {
    PLAYHOUSES: 'gid://shopify/Collection/509726458145',
    PETTING_FARMS: 'gid://shopify/Collection/509771153697',
    EVENTS: 'gid://shopify/Collection/509771120929',
};

export default function TicketingScreen() {
    const { reset: resetTabBar } = useTabBarVisibility();
    const router = useRouter();
    const [collections, setCollections] = useState<Record<string, { imageUrl: string; title: string }>>({});
    const [loading, setLoading] = useState(true);

    // Reset tab bar visibility when entering the screen
    useEffect(() => {
        resetTabBar();
        return () => resetTabBar();
    }, []);

    // Fetch collection images from Shopify
    useEffect(() => {
        const fetchCollectionImages = async () => {
            try {
                setLoading(true);
                const [playhouses, pettingFarms, events] = await Promise.all([
                    shopifyApi.getCollectionById(COLLECTION_IDS.PLAYHOUSES),
                    shopifyApi.getCollectionById(COLLECTION_IDS.PETTING_FARMS),
                    shopifyApi.getCollectionById(COLLECTION_IDS.EVENTS),
                ]);

                const collectionData: Record<string, { imageUrl: string; title: string }> = {};

                if (playhouses) {
                    collectionData[COLLECTION_IDS.PLAYHOUSES] = {
                        imageUrl: playhouses.image?.url || 'https://via.placeholder.com/300x300?text=Playhouses',
                        title: playhouses.title || 'Playhouses',
                    };
                }

                if (pettingFarms) {
                    collectionData[COLLECTION_IDS.PETTING_FARMS] = {
                        imageUrl: pettingFarms.image?.url || 'https://via.placeholder.com/300x300?text=Petting+Farms',
                        title: pettingFarms.title || 'Petting Farms',
                    };
                }

                if (events) {
                    collectionData[COLLECTION_IDS.EVENTS] = {
                        imageUrl: events.image?.url || 'https://via.placeholder.com/300x300?text=Events',
                        title: events.title || 'Events',
                    };
                }

                setCollections(collectionData);
            } catch (error) {
                console.error('Error fetching collection images:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCollectionImages();
    }, []);

    // Banner image URL
    const bannerImageUrl = 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/ChatGPT_Image_Feb_5_2026_02_06_50_PM.png?v=1770280647';

    // Grid items for collections
    const gridItems: GridItem[] = [
        {
            id: COLLECTION_IDS.PLAYHOUSES,
            imageUrl: collections[COLLECTION_IDS.PLAYHOUSES]?.imageUrl || 'https://via.placeholder.com/300x300?text=Playhouses',
            label: collections[COLLECTION_IDS.PLAYHOUSES]?.title || 'Playhouses',
            onPress: () => {
                router.push({
                    pathname: '/infinity/[collectionId]',
                    params: { 
                        collectionId: COLLECTION_IDS.PLAYHOUSES,
                        title: collections[COLLECTION_IDS.PLAYHOUSES]?.title || 'Playhouses',
                        hideFilters: 'true',
                        fromTicketing: 'true'
                    }
                } as any);
            },
        },
        {
            id: COLLECTION_IDS.PETTING_FARMS,
            imageUrl: collections[COLLECTION_IDS.PETTING_FARMS]?.imageUrl || 'https://via.placeholder.com/300x300?text=Petting+Farms',
            label: collections[COLLECTION_IDS.PETTING_FARMS]?.title || 'Petting Farms',
            onPress: () => {
                router.push({
                    pathname: '/infinity/[collectionId]',
                    params: { 
                        collectionId: COLLECTION_IDS.PETTING_FARMS,
                        title: collections[COLLECTION_IDS.PETTING_FARMS]?.title || 'Petting Farms',
                        hideFilters: 'true',
                        fromTicketing: 'true'
                    }
                } as any);
            },
        },
        {
            id: COLLECTION_IDS.EVENTS,
            imageUrl: collections[COLLECTION_IDS.EVENTS]?.imageUrl || 'https://via.placeholder.com/300x300?text=Events',
            label: collections[COLLECTION_IDS.EVENTS]?.title || 'Events',
            onPress: () => {
                router.push({
                    pathname: '/infinity/[collectionId]',
                    params: { 
                        collectionId: COLLECTION_IDS.EVENTS,
                        title: collections[COLLECTION_IDS.EVENTS]?.title || 'Events',
                        hideFilters: 'true',
                        fromTicketing: 'true'
                    }
                } as any);
            },
        },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader title="Ticketing" showSearch={false} showWishlist={false} />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Banner */}
                        <View style={styles.bannerContainer}>
                            <Image
                                source={{ uri: bannerImageUrl }}
                                style={styles.bannerImage}
                                resizeMode="cover"
                            />
                        </View>

                {/* 2x2 Grid */}
                <View style={styles.gridContainer}>
                    <Text style={styles.headline}>Buy tickets to your favourite spots</Text>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                        </View>
                    ) : (
                        <FlexibleGrid
                            items={gridItems}
                            layout="uniform"
                            numColumns={2}
                            gap={16}
                            padding={20}
                            aspectRatio={1}
                            imageResizeMode="cover"
                            showLabels={true}
                            borderRadius={12}
                        />
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    bannerContainer: {
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
    },
    bannerImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
    },
    gridContainer: {
        width: '100%',
    },
    headline: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        paddingHorizontal: 20,
        marginTop: 16,
        marginBottom: 0,
        textAlign: 'left',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
});


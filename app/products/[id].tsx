import HorizontalProductList from '@/components/content/HorizontalProductList';
import { InfiniteProductGrid as InfiniteProductGridComponent } from '@/components/products/InfiniteProductGrid';
import { ProductTrustStrip } from '@/components/products/ProductTrustStrip';
import { TryBuyModal as TryAndBuyModal } from '@/components/products/TryBuyModal';
import { TryBuyPdpVariantSection } from '@/components/products/TryBuyPdpVariantSection';
import BaseModal from '@/components/ui/BaseModal';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import ImageViewerModal from '@/components/ui/ImageViewerModal';
import UniversalAdd from '@/components/ui/UniversalAdd';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useRecentlyViewed } from '@/context/RecentlyViewedContext';
import { useWishlist } from '@/context/WishlistContext';
import { useScrollTracking } from '@/hooks/useScrollTracking';
import { analyticsService } from '@/services/analyticsService';
import { configService } from '@/services/configService';
import { shopifyApi } from '@/services/shopifyApi';
import { useCartStore } from '@/store/cartStore';
import { isVariantAvailable } from '@/utils/availability';
import { processFontStyle } from '@/utils/fontUtils';
import { hasTryAndBuyProduct } from '@/utils/tryAndBuyProduct';
import { findTryVariantForPrimary, getTryBuyPdpMainOptionNameForDefer } from '@/utils/tryBuyVariantSelection';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// @ts-ignore - expo-blur types may not be properly recognized
const BlurView = require('expo-blur').BlurView;

// Demo PDP section configuration
const DEMO_PDP_CONFIG = {
    imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/08733a2192a952536958cb74bb5830bb723113fa.png?v=1781594101',
    bulletPoints: [
        'Kiddo partner visits for a 30-minute demo',
        'Ensures product meets personalized needs',
        'Option to buy via digital payment or cash'
    ]
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Format date as YYYY-MM-DD for ticketing cart item. */
function bookingDateToYYYYMMDD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Event Date Picker Component - Shows next 7 days or available dates
const EventDatePicker: React.FC<{
    selectedDate: Date | null;
    onDateSelect: (date: Date) => void;
    availableDates?: Date[];
}> = ({ selectedDate, onDateSelect, availableDates }) => {
    // Generate dates to show
    const datesToShow = useMemo(() => {
        // If availableDates is provided (even if empty), use it as the source of truth.
        // This prevents "fallback next 7 days" for Events where variants define valid dates.
        if (availableDates !== undefined) return availableDates;

        // Fallback: Generate next 7 days
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            days.push(date);
        }
        return days;
    }, [availableDates]);

    const formatDateLabel = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const dateToCheck = new Date(date);
        dateToCheck.setHours(0, 0, 0, 0);

        if (dateToCheck.getTime() === today.getTime()) {
            return 'Today';
        } else if (dateToCheck.getTime() === tomorrow.getTime()) {
            return 'Tomorrow';
        } else {
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        }
    };

    const isDateSelected = (date: Date) => {
        if (!selectedDate) return false;
        // Compare dates (ignoring time)
        const d1 = new Date(date);
        d1.setHours(0, 0, 0, 0);
        const d2 = new Date(selectedDate);
        d2.setHours(0, 0, 0, 0);
        return d1.getTime() === d2.getTime();
    };

    const isTodayOrTomorrow = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime() || d.getTime() === tomorrow.getTime();
    };

    const next7Days = datesToShow;

    return (
        <View style={datePickerStyles.container}>
            <ScrollView
                style={datePickerStyles.daysList}
                contentContainerStyle={datePickerStyles.daysListContent}
                showsVerticalScrollIndicator={false}
            >
                {next7Days.length > 0 ? next7Days.map((date, index) => {
                    const isSelected = isDateSelected(date);
                    const showSubLabel = isTodayOrTomorrow(date);
                    return (
                        <TouchableOpacity
                            key={`date-${index}-${date.getTime()}`}
                            style={[
                                datePickerStyles.dateOption,
                                isSelected && datePickerStyles.dateOptionSelected
                            ]}
                            onPress={() => onDateSelect(date)}
                            activeOpacity={0.7}
                        >
                            <View style={datePickerStyles.dateOptionContent}>
                                <Text style={[
                                    datePickerStyles.dateLabel,
                                    isSelected && datePickerStyles.dateLabelSelected
                                ]}>
                                    {formatDateLabel(date)}
                                </Text>
                                {showSubLabel && (
                                    <Text style={[
                                        datePickerStyles.dateSubLabel,
                                        isSelected && datePickerStyles.dateSubLabelSelected
                                    ]}>
                                        {date.toLocaleDateString('en-US', {
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </Text>
                                )}
                            </View>
                            {isSelected && (
                                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                            )}
                        </TouchableOpacity>
                    );
                }) : (
                    <View style={datePickerStyles.emptyState}>
                        <Text style={datePickerStyles.emptyStateText}>No dates available</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const datePickerStyles = StyleSheet.create({
    container: {
        padding: 20,
        minHeight: 300,
        maxHeight: 500,
    },
    daysList: {
        flex: 1,
    },
    daysListContent: {
        paddingBottom: 10,
    },
    dateOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    dateOptionSelected: {
        borderColor: Colors.primary,
        backgroundColor: '#FFF5F5',
    },
    dateOptionContent: {
        flex: 1,
    },
    dateLabel: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
        marginBottom: 4,
    },
    dateLabelSelected: {
        color: Colors.primary,
    },
    dateSubLabel: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
    },
    dateSubLabelSelected: {
        color: Colors.text,
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.textSecondary,
    },
});

const ProductDetailScreen = () => {
    const params = useLocalSearchParams();
    const router = useRouter();
    const { handleScroll } = useScrollTracking();
    const insets = useSafeAreaInsets();

    const getProductDeepLink = (pathSegment: string) => {
        return `https://allforkiddo.com/products/${pathSegment}`;
    };

    const productId = typeof params.id === 'string' ? params.id : null;
    const productHandle = typeof params.handle === 'string' ? params.handle : null;

    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedVariant, setSelectedVariant] = useState<any>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
    const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);
    const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<any[]>([]);
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [tryAndBuyModalVisible, setTryAndBuyModalVisible] = useState(false);
    /** PDP inline Try & Buy: optional second size (first option row is primary). */
    const [pdpTrySizeValue, setPdpTrySizeValue] = useState<string | null>(null);
    const imageFlatListRef = useRef<any>(null);
    const { user, isAuthenticated } = useAuth();
    const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
    const { addToRecentlyViewed, getRecentlyViewed } = useRecentlyViewed();
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const imageGestureRef = useRef({ isHorizontal: false });

    // Event date selection state
    const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showDateError, setShowDateError] = useState(false);
    const [showRefundPolicyModal, setShowRefundPolicyModal] = useState(false);
    // Collection IDs that require date selection
    const TICKETING_COLLECTION_IDS = [
        'gid://shopify/Collection/509771120929', // Events
        'gid://shopify/Collection/509726458145', // Playhouses
        'gid://shopify/Collection/509771153697', // Petting Farms
    ];
    const EVENTS_COLLECTION_ID = 'gid://shopify/Collection/509771120929';

    // Check if product is from ticketing collections (Events, Playhouses, Petting Farms)
    const isTicketingProduct = useMemo(() => {
        // Check if we came from a ticketing collection (check route params)
        const collectionId = params.collectionId as string;
        const fromTicketing = collectionId && TICKETING_COLLECTION_IDS.some(id =>
            collectionId === id || collectionId.includes(id.split('/').pop() || '')
        );

        // Or check if product has relevant tags
        const hasTicketingTag = product?.tags?.some((tag: any) => {
            const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
            return tagLower.includes('event') ||
                tagLower.includes('playhouse') ||
                tagLower.includes('petting') ||
                tagLower.includes('farm');
        });

        // Or check if product belongs to any ticketing collection
        const belongsToTicketing = product?.collections?.some((col: any) => {
            const colId = col?.id || col?.node?.id || '';
            return TICKETING_COLLECTION_IDS.some(ticketingId =>
                colId === ticketingId || colId.includes(ticketingId.split('/').pop() || '')
            );
        });

        const result = fromTicketing || hasTicketingTag || belongsToTicketing;
        // Debug logging
        if (__DEV__) {
            console.log('[DatePicker] isTicketingProduct check:', {
                fromTicketing,
                hasTicketingTag,
                belongsToTicketing,
                result,
                collectionId: params.collectionId,
                productTags: product?.tags,
            });
        }
        return result;
    }, [params, product]);

    // Only Events uses predefined dates from variants (variants represent event dates).
    // Playhouses & Petting Farms keep the "next 7 days" picker behavior.
    const isEventsProduct = useMemo(() => {
        const collectionId = params.collectionId as string | undefined;
        const fromEventsCollection =
            !!collectionId &&
            (collectionId === EVENTS_COLLECTION_ID ||
                collectionId.includes(EVENTS_COLLECTION_ID.split('/').pop() || ''));

        const hasEventsTag = product?.tags?.some((tag: any) => {
            const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
            return tagLower.includes('event');
        });

        const belongsToEvents = product?.collections?.some((col: any) => {
            const colId = col?.id || col?.node?.id || '';
            return (
                colId === EVENTS_COLLECTION_ID ||
                colId.includes(EVENTS_COLLECTION_ID.split('/').pop() || '')
            );
        });

        // Some Events products don't have an "event" tag. If the product has a "Date" option in Shopify,
        // it's very likely an Event where variants represent dates.
        const hasDateOption = product?.options?.some((opt: any) => {
            const name = String(opt?.name || '').toLowerCase();
            return name.includes('date') && Array.isArray(opt?.values) && opt.values.length > 0;
        });

        return isTicketingProduct && (fromEventsCollection || hasEventsTag || belongsToEvents || hasDateOption);
    }, [params.collectionId, product, isTicketingProduct]);

    // Extract available dates from Events variants (if any)
    const ticketingVariants = useMemo(() => {
        if (!product || !isEventsProduct) return [];
        if (product?.variants?.edges) {
            return product.variants.edges.map((edge: any) => edge?.node).filter(Boolean);
        }
        if (Array.isArray(product?.variants)) {
            return product.variants.filter(Boolean);
        }
        return [];
    }, [product, isEventsProduct]);

    const parseTicketingDate = useCallback((raw: any): Date | null => {
        if (!raw || typeof raw !== 'string') return null;
        const s = raw.trim();
        if (!s) return null;

        // 1) Try native parse (works for ISO and many Shopify formats)
        const d1 = new Date(s);
        if (!isNaN(d1.getTime())) return d1;

        // 1.5) Try to extract an ISO date (YYYY-MM-DD) from within a longer string
        const iso = s.match(/(\d{4}-\d{2}-\d{2})/);
        if (iso) {
            const dIso = new Date(iso[1]);
            if (!isNaN(dIso.getTime())) return dIso;
        }

        // 2) Try common dd/mm/yyyy or dd-mm-yyyy
        const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) {
            const dd = parseInt(m[1], 10);
            const mm = parseInt(m[2], 10);
            const yyyy = parseInt(m[3], 10);
            const d2 = new Date(yyyy, mm - 1, dd);
            if (!isNaN(d2.getTime())) return d2;
        }

        // 3) Handle formats like "15th Feb", "15 Feb", "Feb 15", optionally with year
        const monthIndex = (name: string) => {
            const key = name.toLowerCase().slice(0, 3);
            const map: Record<string, number> = {
                jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
                jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
            };
            return map[key] ?? -1;
        };
        const stripOrdinal = (v: string) => v.replace(/(\d)(st|nd|rd|th)\b/gi, '$1');

        const s2 = stripOrdinal(s).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

        // "15 Feb 2026" or "15 Feb"
        const dmY = s2.match(/^(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?$/);
        if (dmY) {
            const dd = parseInt(dmY[1], 10);
            const mm = monthIndex(dmY[2]);
            if (mm >= 0 && dd >= 1 && dd <= 31) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const yyyy = dmY[3] ? parseInt(dmY[3], 10) : today.getFullYear();
                let d = new Date(yyyy, mm, dd);
                d.setHours(0, 0, 0, 0);
                // If year was missing and date already passed this year, roll to next year
                if (!dmY[3] && d.getTime() < today.getTime()) {
                    d = new Date(yyyy + 1, mm, dd);
                    d.setHours(0, 0, 0, 0);
                }
                if (!isNaN(d.getTime())) return d;
            }
        }

        // "Feb 15 2026" or "Feb 15"
        const mdY = s2.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:\s+(\d{4}))?$/);
        if (mdY) {
            const mm = monthIndex(mdY[1]);
            const dd = parseInt(mdY[2], 10);
            if (mm >= 0 && dd >= 1 && dd <= 31) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const yyyy = mdY[3] ? parseInt(mdY[3], 10) : today.getFullYear();
                let d = new Date(yyyy, mm, dd);
                d.setHours(0, 0, 0, 0);
                if (!mdY[3] && d.getTime() < today.getTime()) {
                    d = new Date(yyyy + 1, mm, dd);
                    d.setHours(0, 0, 0, 0);
                }
                if (!isNaN(d.getTime())) return d;
            }
        }

        return null;
    }, []);

    const normalizeDateKey = useCallback((date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        // YYYY-MM-DD
        return d.toISOString().slice(0, 10);
    }, []);

    const ticketingDateEntries = useMemo(() => {
        if (!isEventsProduct) return [];

        // Build a unique list of dates from variants. Prefer variants that are actually available.
        const byKey = new Map<string, { date: Date; variant: any }>();

        ticketingVariants.forEach((variant: any) => {
            if (!variant) return;

            // Prefer explicit "Date" selected option, else fall back to variant title.
            const dateOpt = Array.isArray(variant.selectedOptions)
                ? variant.selectedOptions.find((opt: any) =>
                    typeof opt?.name === 'string' && opt.name.toLowerCase().includes('date')
                )
                : null;

            const candidateRaw = dateOpt?.value || variant.title;
            const parsed = parseTicketingDate(candidateRaw);
            if (!parsed) return;

            const key = normalizeDateKey(parsed);
            const existing = byKey.get(key);
            if (!existing) {
                byKey.set(key, { date: parsed, variant });
                return;
            }

            // Prefer an in-stock/available variant if there are duplicates for the same day.
            const existingAvailable = existing.variant?.availableForSale !== false;
            const nextAvailable = variant?.availableForSale !== false;
            if (!existingAvailable && nextAvailable) {
                byKey.set(key, { date: parsed, variant });
            }
        });

        return Array.from(byKey.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [isEventsProduct, ticketingVariants, normalizeDateKey, parseTicketingDate]);

    const availableDates = useMemo(() => {
        if (!isEventsProduct) return undefined;
        return ticketingDateEntries.map((e) => e.date);
    }, [isEventsProduct, ticketingDateEntries]);

    const variantForDate = useCallback((date: Date) => {
        const key = normalizeDateKey(date);
        const entry = ticketingDateEntries.find((e) => normalizeDateKey(e.date) === key);
        return entry?.variant || null;
    }, [normalizeDateKey, ticketingDateEntries]);

    const syncSelectedOptionsFromVariant = useCallback((variant: any) => {
        if (!variant?.selectedOptions) return;
        const next: Record<string, string> = {};
        variant.selectedOptions.forEach((opt: any) => {
            if (opt?.name && opt?.value) next[String(opt.name)] = String(opt.value);
        });
        setSelectedOptions(next);
    }, []);

    // If there is only one available ticketing date, auto-select it (still shown as selected in UI)
    useEffect(() => {
        if (!isEventsProduct) return;
        if (ticketingDateEntries.length !== 1) return;
        if (selectedEventDate) return;

        const only = ticketingDateEntries[0];
        setSelectedEventDate(only.date);
        setSelectedVariant(only.variant);
        syncSelectedOptionsFromVariant(only.variant);
        setShowDateError(false);
    }, [isEventsProduct, ticketingDateEntries, selectedEventDate, syncSelectedOptionsFromVariant]);

    // Get product detail config
    const productDetailConfig = configService.getProductDetailConfig();
    const recommendationsConfig = productDetailConfig?.sections?.recommendations || {};
    const recentlyViewedConfig = productDetailConfig?.sections?.recentlyViewed || {};
    const productStyles = productDetailConfig?.styles || {};

    // Initialize variant from product data
    const initializeVariant = useCallback((productData: any) => {
        if (!productData) return;

        let variants = [];
        if (productData.variants?.edges) {
            variants = productData.variants.edges.map((e: any) => e.node);
        } else if (Array.isArray(productData.variants)) {
            variants = productData.variants;
        }

        // Find first available variant (check both availableForSale and quantityAvailable)
        // Fallback to first variant if none available
        const firstVariant = variants.find((v: any) => {
            if (v.availableForSale === false) return false;
            if (v.quantityAvailable !== undefined && v.quantityAvailable !== null) {
                return v.quantityAvailable > 0;
            }
            return v.availableForSale !== false;
        }) || variants[0];

        if (firstVariant) {
            setSelectedVariant(firstVariant);
            if (firstVariant.selectedOptions) {
                const collectionId = params.collectionId as string | undefined;
                const fromTicketing =
                    !!collectionId &&
                    TICKETING_COLLECTION_IDS.some(
                        (id) => collectionId === id || collectionId.includes(id.split('/').pop() || ''),
                    );
                const hasTicketingTag = productData?.tags?.some((tag: any) => {
                    const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
                    return (
                        tagLower.includes('event') ||
                        tagLower.includes('playhouse') ||
                        tagLower.includes('petting') ||
                        tagLower.includes('farm')
                    );
                });
                const belongsToTicketing = productData?.collections?.some((col: any) => {
                    const colId = col?.id || col?.node?.id || '';
                    return TICKETING_COLLECTION_IDS.some(
                        (ticketingId) =>
                            colId === ticketingId || colId.includes(ticketingId.split('/').pop() || ''),
                    );
                });
                const isTicketingForInit = !!(fromTicketing || hasTicketingTag || belongsToTicketing);

                const initialOptions: Record<string, string> = {};
                firstVariant.selectedOptions.forEach((opt: any) => {
                    initialOptions[opt.name] = opt.value;
                });
                const deferMainName = getTryBuyPdpMainOptionNameForDefer(
                    productData,
                    variants.length,
                    isTicketingForInit,
                );
                if (deferMainName && initialOptions[deferMainName] !== undefined) {
                    delete initialOptions[deferMainName];
                }
                setSelectedOptions(initialOptions);
            }
        }
    }, [params.collectionId]);

    const loadProductDetails = useCallback(async () => {
        try {
            setLoading(true);
            let fullProduct = null;

            if (productHandle) {
                fullProduct = await shopifyApi.getProductByHandle(productHandle);
            }

            if (!fullProduct && productId) {
                const looksLikeGid = typeof productId === 'string' && productId.startsWith('gid://');
                if (looksLikeGid) {
                    fullProduct = await shopifyApi.getProductById(productId);
                } else {
                    fullProduct = await shopifyApi.getProductByHandle(productId);
                }
            }

            if (fullProduct) {
                setProduct(fullProduct);
                initializeVariant(fullProduct);
                loadProductRecommendations(fullProduct.id);

                // Add to recently viewed
                let imageUrl = '';
                if (fullProduct?.images?.edges) {
                    imageUrl = fullProduct.images.edges[0]?.node?.url || '';
                } else if (Array.isArray(fullProduct?.images)) {
                    imageUrl = fullProduct.images[0]?.url || fullProduct.images[0] || '';
                }

                addToRecentlyViewed({
                    id: fullProduct.id,
                    handle: fullProduct.handle,
                    title: fullProduct.title,
                    image: imageUrl,
                });

                // Track Product Viewed event
                try {
                    const { trackProductViewed, trackFirstProductViewed } = require('@/utils/mixpanelHelpers');
                    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                    const price = parseFloat(
                        fullProduct.priceRange?.minVariantPrice?.amount ||
                        fullProduct.variants?.edges?.[0]?.node?.price?.amount ||
                        '0'
                    );
                    const hasViewedProduct = await AsyncStorage.getItem('has_viewed_product');
                    if (!hasViewedProduct) {
                        trackFirstProductViewed(fullProduct.id, fullProduct.title);
                        await AsyncStorage.setItem('has_viewed_product', 'true');
                    }
                    trackProductViewed(fullProduct.id, fullProduct.title, price);

                    // Firebase Ecommerce Tracking
                    analyticsService.logViewItem({
                        items: [{
                            item_id: fullProduct.id,
                            item_name: fullProduct.title,
                            item_category: fullProduct.tags?.[0],
                            price: price,
                            quantity: 1,
                        }],
                        value: price,
                        currency: 'INR',
                    });
                } catch (e) {
                    console.warn('Mixpanel tracking error:', e);
                }

                // Load recently viewed products (excluding current)
                loadRecentlyViewedProducts(fullProduct.handle);
            }
        } catch (error) {
            console.error('Error loading product details:', error);
        } finally {
            setLoading(false);
        }
    }, [productId, productHandle, initializeVariant]);

    // ... (omitting unchanged parts for brevity if possible in single hunk, but since it's scattered, I'll do multiple replacements or one big block if contiguous)

    // Wait, I should probably do multiple smaller replacements for safety and clarity.
    // Let's split this. First, variant logic.


    const loadProductRecommendations = async (id: string) => {
        try {
            const recommendations = await shopifyApi.getProductRecommendations(id);
            if (recommendations) {
                const limit = recommendationsConfig.limit || 10;
                setRecommendedProducts(recommendations.slice(0, limit));
            }
        } catch (error) {
            console.error('Error loading recommendations:', error);
        }
    };

    const loadRecentlyViewedProducts = async (excludeHandle: string) => {
        try {
            const recentlyViewed = getRecentlyViewed(excludeHandle);
            if (recentlyViewed.length === 0) {
                setRecentlyViewedProducts([]);
                return;
            }

            const limit = recentlyViewedConfig.limit || 10;
            // Fetch product details for recently viewed handles
            const productPromises = recentlyViewed.slice(0, limit).map((item) =>
                shopifyApi.getProductByHandle(item.handle).catch(() => null)
            );

            const products = await Promise.all(productPromises);
            const validProducts = products.filter((p) => p !== null);
            setRecentlyViewedProducts(validProducts);
        } catch (error) {
            console.error('Error loading recently viewed products:', error);
        }
    };

    // Helper function to render product sections based on config
    const renderProductSection = (
        products: any[],
        config: any,
        defaultTitle: string
    ) => {
        if (config.enabled === false || products.length === 0) return null;

        const sectionType = config.type || 'horizontalProductList';
        const title = config.title || defaultTitle;
        const gapStyle = config.gap || { height: 0, backgroundColor: 'transparent', marginTop: 8 };

        const handleProductPress = (p: any) => {
            // Track recommendation clicked
            try {
                const { trackRecommendationClicked } = require('@/utils/mixpanelHelpers');
                const recommendationType = title === 'You May Also Like' ? 'product_recommendation' :
                    title === 'Recently Viewed' ? 'recently_viewed' : 'related';
                trackRecommendationClicked(recommendationType, p.id, p.title);
            } catch (e) {
                console.warn('Mixpanel tracking error:', e);
            }

            router.push({ pathname: '/products/[id]', params: { id: p.id, handle: p.handle } });
        };

        return (
            <>
                <View style={[styles.recommendationsGap, gapStyle]} />
                {sectionType === 'infiniteProductGrid' ? (
                    <View style={[styles.sectionCard, styles.sectionCardEmbedList]}>
                        <InfiniteProductGridComponent
                            products={products}
                            title={title}
                            showHeading={!!title}
                            style={{
                                root: config.styles?.container,
                                title: config.styles?.title,
                                list: config.styles?.list,
                            }}
                            contentWidth={SCREEN_WIDTH}
                            productOptions={config.config || {}}
                            scrollable={false}
                        />
                    </View>
                ) : (
                    <View style={[styles.sectionCard, styles.sectionCardEmbedList]}>
                        <HorizontalProductList
                            products={products}
                            title={title}
                            onProductPress={handleProductPress}
                            config={config.config || {}}
                            styles={config.styles || {}}
                        />
                    </View>
                )}
            </>
        );
    };

    useEffect(() => {
        loadProductDetails();
    }, [loadProductDetails]);

    const handleAddToCart = async () => {
        if (selectedVariant && selectedVariant.availableForSale) {
            try {
                const addItem = useCartStore.getState().addItem;

                // Get image URL
                const imageUrl = selectedVariant.image?.url ||
                    product.images?.[0]?.url ||
                    product.featuredImage?.url ||
                    product.images?.edges?.[0]?.node?.url ||
                    '';

                // Get price
                const price = parseFloat(
                    selectedVariant.price?.amount ||
                    product.priceRange?.minVariantPrice?.amount ||
                    product.price?.amount ||
                    '0'
                );

                // Create cart item (include quantityAvailable so cart can enforce stock)
                const quantityAvailable = selectedVariant.quantityAvailable != null ? Number(selectedVariant.quantityAvailable) : undefined;
                const cartItem = {
                    productId: productId || '',
                    variantId: selectedVariant.id || '',
                    title: product.title || product.name || 'Product',
                    variantTitle: selectedVariant.title,
                    price,
                    compareAtPrice: selectedVariant.compareAtPrice?.amount
                        ? parseFloat(selectedVariant.compareAtPrice.amount)
                        : undefined,
                    currencyCode: selectedVariant.price?.currencyCode || product.priceRange?.minVariantPrice?.currencyCode || 'INR',
                    image: imageUrl,
                    quantity: 1,
                    availableForSale: selectedVariant.availableForSale !== false,
                    quantityAvailable: Number.isFinite(quantityAvailable) ? quantityAvailable : undefined,
                    tags: product.tags || [],
                };

                await addItem(cartItem);

                // Track Add to Cart event
                try {
                    const { trackAddToCart, trackFirstAddToCart } = require('@/utils/mixpanelHelpers');
                    const AsyncStorage = require('@react-native-async-storage/async-storage').default;

                    const hasAddedToCart = await AsyncStorage.getItem('has_added_to_cart');
                    if (!hasAddedToCart) {
                        trackFirstAddToCart(cartItem.productId, cartItem.title, cartItem.price);
                        await AsyncStorage.setItem('has_added_to_cart', 'true');
                    }
                    trackAddToCart(cartItem.productId, cartItem.title, cartItem.price, cartItem.quantity);

                    // Firebase Ecommerce Tracking
                    analyticsService.logAddToCart({
                        items: [{
                            item_id: cartItem.productId,
                            item_name: cartItem.title,
                            item_category: cartItem.tags?.[0],
                            price: cartItem.price,
                            quantity: cartItem.quantity,
                            currency: cartItem.currencyCode,
                        }],
                        value: cartItem.price * cartItem.quantity,
                        currency: cartItem.currencyCode,
                    });
                } catch (e) {
                    console.warn('[PDP] AddToCart tracking error:', e);
                }
            } catch (error: any) {
                alert(error.message || 'Failed to add item to cart. Please try again.');
            }
        }
    };

    const images = useMemo(() => {
        let extractedImages: string[] = [];
        if (product?.images?.edges) {
            extractedImages = product.images.edges.map((edge: any) => edge?.node?.url);
        } else if (Array.isArray(product?.images)) {
            extractedImages = product.images.map((img: any) => img?.url || img);
        } else if (product?.image) {
            extractedImages = [product.image.url || product.image];
        }
        const productUrls = extractedImages.filter(Boolean) as string[];

        // When a variant is selected and has its own image, show that image first
        const variantImageUrl = selectedVariant?.image?.url || selectedVariant?.image;
        if (variantImageUrl && typeof variantImageUrl === 'string') {
            const rest = productUrls.filter((url) => url !== variantImageUrl);
            return [variantImageUrl, ...rest];
        }
        return productUrls;
    }, [product, selectedVariant]);

    const variants = useMemo(() => {
        if (product?.variants?.edges) {
            return product.variants.edges.map((edge: any) => edge?.node).filter(Boolean);
        }
        if (Array.isArray(product?.variants)) {
            return product.variants.filter(Boolean);
        }
        return [];
    }, [product]);

    // When user selects a date in ticketing, add the item to cart immediately (1 qty, with bookingDate)
    const handleDateSelectAndAddToCart = useCallback(
        async (date: Date) => {
            const variant = isEventsProduct ? variantForDate(date) : (selectedVariant || variants[0]);
            if (!variant || !product) return;

            setSelectedEventDate(date);
            setSelectedVariant(variant);
            syncSelectedOptionsFromVariant(variant);
            setShowDateError(false);

            try {
                const addItem = useCartStore.getState().addItem;
                const imageUrl =
                    variant.image?.url ||
                    product.images?.[0]?.url ||
                    product.featuredImage?.url ||
                    product.images?.edges?.[0]?.node?.url ||
                    '';
                const price = parseFloat(
                    variant.price?.amount ||
                    product.priceRange?.minVariantPrice?.amount ||
                    product.price?.amount ||
                    '0'
                );
                const quantityAvailable =
                    variant.quantityAvailable != null ? Number(variant.quantityAvailable) : undefined;
                const cartItem = {
                    productId: productId || '',
                    variantId: variant.id || '',
                    title: product.title || product.name || 'Product',
                    variantTitle: variant.title,
                    price,
                    compareAtPrice: variant.compareAtPrice?.amount
                        ? parseFloat(variant.compareAtPrice.amount)
                        : undefined,
                    currencyCode:
                        variant.price?.currencyCode ||
                        product.priceRange?.minVariantPrice?.currencyCode ||
                        'INR',
                    image: imageUrl,
                    quantity: 1,
                    availableForSale: variant.availableForSale !== false,
                    quantityAvailable: Number.isFinite(quantityAvailable) ? quantityAvailable : undefined,
                    tags: product.tags || [],
                    bookingDate: bookingDateToYYYYMMDD(date),
                };
                await addItem(cartItem);

                // Track Add to Cart event
                try {
                    const { trackAddToCart, trackFirstAddToCart } = require('@/utils/mixpanelHelpers');
                    const AsyncStorage = require('@react-native-async-storage/async-storage').default;

                    const hasAddedToCart = await AsyncStorage.getItem('has_added_to_cart');
                    if (!hasAddedToCart) {
                        trackFirstAddToCart(cartItem.productId, cartItem.title, cartItem.price);
                        await AsyncStorage.setItem('has_added_to_cart', 'true');
                    }
                    trackAddToCart(cartItem.productId, cartItem.title, cartItem.price, cartItem.quantity);

                    // Firebase Ecommerce Tracking
                    analyticsService.logAddToCart({
                        items: [{
                            item_id: cartItem.productId,
                            item_name: cartItem.title,
                            item_category: cartItem.tags?.[0],
                            price: cartItem.price,
                            quantity: cartItem.quantity,
                            currency: cartItem.currencyCode,
                        }],
                        value: cartItem.price * cartItem.quantity,
                        currency: cartItem.currencyCode,
                    });
                } catch (e) {
                    console.warn('[PDP] Ticketing AddToCart tracking error:', e);
                }
            } catch (error: any) {
                alert(error?.message || 'Failed to add to cart. Please try again.');
            }
            setShowDatePicker(false);
        },
        [
            isEventsProduct,
            variantForDate,
            selectedVariant,
            variants,
            product,
            productId,
            syncSelectedOptionsFromVariant,
        ]
    );

    const productOptions = useMemo(() => {
        if (!product?.options) return [];
        const options = Array.isArray(product.options) ? product.options : [];
        if (variants.length <= 1) return [];
        // For ticketing products, hide only the "Date" option pills (date is selected via the date picker).
        // Keep other option pills (e.g., time slot, ticket type) if present.
        const filtered = isTicketingProduct
            ? options.filter((option: any) => {
                const name = String(option?.name || '').toLowerCase();
                return !name.includes('date');
            })
            : options;
        return filtered.filter((option: any) => (option.values || []).length > 1);
    }, [product, variants.length, isTicketingProduct]);

    const tryBuyPdpEligible = useMemo(
        () =>
            !!product &&
            hasTryAndBuyProduct(product) &&
            !isTicketingProduct &&
            productOptions.length > 0,
        [product, isTicketingProduct, productOptions.length],
    );

    const pdpMainTryBuyOption = tryBuyPdpEligible ? productOptions[0] : null;
    const pdpRestProductOptions = useMemo(
        () => (tryBuyPdpEligible ? productOptions.slice(1) : productOptions),
        [tryBuyPdpEligible, productOptions],
    );

    const pdpResolvedTryVariant = useMemo(() => {
        if (!tryBuyPdpEligible || !pdpMainTryBuyOption || !selectedVariant || !pdpTrySizeValue) {
            return undefined;
        }
        const pv = selectedOptions[pdpMainTryBuyOption.name];
        if (!pv || pdpTrySizeValue === pv) return undefined;
        return findTryVariantForPrimary(variants, selectedVariant, pdpMainTryBuyOption.name, pdpTrySizeValue) || undefined;
    }, [
        tryBuyPdpEligible,
        pdpMainTryBuyOption,
        selectedVariant,
        pdpTrySizeValue,
        selectedOptions,
        variants,
    ]);

    useEffect(() => {
        setPdpTrySizeValue(null);
    }, [product?.id]);

    useEffect(() => {
        if (!pdpMainTryBuyOption || pdpTrySizeValue == null) return;
        const pv = selectedOptions[pdpMainTryBuyOption.name];
        if (pv === pdpTrySizeValue) {
            setPdpTrySizeValue(null);
        }
    }, [selectedOptions, pdpMainTryBuyOption?.name, pdpTrySizeValue]);

    const findVariantByOptions = useCallback((options: Record<string, string>, variantsList: any[]) => {
        if (!variantsList || variantsList.length === 0) return null;
        return variantsList.find((variant) => {
            if (!variant.selectedOptions) return false;
            return Object.keys(options).every((optionName) => {
                const selectedValue = options[optionName];
                return variant.selectedOptions.some(
                    (opt: any) => opt.name === optionName && opt.value === selectedValue
                );
            });
        });
    }, []);

    useEffect(() => {
        if (productOptions.length > 0 && variants.length > 0) {
            const matchingVariant = findVariantByOptions(selectedOptions, variants);
            if (matchingVariant) {
                setSelectedVariant(matchingVariant);
                // Reset carousel to first image so variant's image is shown
                setSelectedImageIndex(0);
            }
        }
    }, [selectedOptions, variants, productOptions, findVariantByOptions]);

    // When selected variant changes, scroll image carousel to first slide
    useEffect(() => {
        if (selectedVariant && imageFlatListRef.current) {
            imageFlatListRef.current.scrollToOffset({ offset: 0, animated: true });
        }
    }, [selectedVariant?.id]);

    const handleOptionSelect = (optionName: string, optionValue: string) => {
        setSelectedOptions((prev) => ({
            ...prev,
            [optionName]: optionValue,
        }));
    };

    const onImageScroll = (event: any) => {
        const slideSize = event.nativeEvent.layoutMeasurement?.width;
        const offset = event.nativeEvent.contentOffset?.x;
        if (!slideSize || offset === undefined) return;
        const index = Math.round(offset / slideSize);
        if (index >= 0 && index < images.length && index !== selectedImageIndex) {
            setSelectedImageIndex(index);
        }
    };

    const handleImagePress = () => {
        if (!imageGestureRef.current.isHorizontal) {
            setImageViewerVisible(true);
        }
    };

    const handleShare = useCallback(async () => {
        if (!product) return;
        const handle = product.handle || (params as any).handle;
        const productId = (params as any).id || product.id;
        const pathSegment = handle || String(productId).replace(/^gid:\/\/shopify\/Product\//i, '');
        const productUrl = getProductDeepLink(pathSegment);

        // Use the first image URL for metadata fallback
        const imageUrl = images[0] || selectedVariant?.image?.url || product.featuredImage?.url || '';

        // Construct the rich share message
        let shareMessage = `${product.title}\n\n`;
        shareMessage += `🌈 Kiddo Price: ${formattedPrice}\n`;
        if (formattedMRP) {
            shareMessage += `🏷️ Original Price: ${formattedMRP}\n`;
        }
        if (discountPercentage) {
            shareMessage += `🎉 Save ${discountPercentage}%\n`;
        }
        shareMessage += `\n⚡️Delivery in 30 minutes\n\n`;
        shareMessage += `Shop on Kiddo: ${productUrl}`;

        try {
            if (Platform.OS === 'android') {
                const cleanImageUrl = imageUrl.split('?')[0];
                await Share.share({
                    message: shareMessage,
                    url: cleanImageUrl, // Providing URL helps with thumbnail on Android
                    title: product.title,
                });
            } else {
                // For iOS, providing both message and url can cause bplist errors in some apps.
                // Including the URL in the message is safer and still triggers previews in WhatsApp.
                await Share.share({
                    message: shareMessage,
                    title: product.title,
                });
            }

            // Track
            try {
                const { trackProductShareClicked } = require('@/utils/mixpanelHelpers');
                trackProductShareClicked(product.id, product.title, 'native');
            } catch (_) { }

        } catch (err: any) {
            if (err?.message !== 'User did not share') {
                console.warn('Share error:', err);
            }
        }
    }, [product, params, images, selectedVariant, formattedPrice, formattedMRP, discountPercentage]);

    const parsePriceSafely = (priceValue: any) => {
        if (!priceValue) return 0;
        const parsed = parseFloat(priceValue);
        return isNaN(parsed) ? 0 : parsed;
    };

    const basePrice = selectedVariant
        ? parsePriceSafely(selectedVariant.price?.amount)
        : parsePriceSafely(product?.priceRange?.minVariantPrice?.amount);

    const mrp = selectedVariant
        ? parsePriceSafely(selectedVariant.compareAtPrice?.amount)
        : 0;

    const savings = mrp > basePrice ? mrp - basePrice : 0;

    // Calculate discount percentage
    const discountPercentage = useMemo(() => {
        if (mrp > basePrice && mrp > 0) {
            const percentage = Math.round(((mrp - basePrice) / mrp) * 100);
            return percentage > 0 ? percentage : null;
        }
        return null;
    }, [mrp, basePrice]);

    const formattedPrice = useMemo(() => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(basePrice);
    }, [basePrice]);

    const formattedMRP = useMemo(() => {
        if (mrp <= 0) return null;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(mrp);
    }, [mrp]);

    const formattedSavings = useMemo(() => {
        if (savings <= 0) return null;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(savings);
    }, [savings]);

    const getMetafieldValue = (product: any, key: string) => {
        if (!product?.metafields) return null;
        if (Array.isArray(product.metafields.edges)) {
            const metafield = product.metafields.edges.find(
                (edge: any) => edge?.node?.key?.toLowerCase() === key.toLowerCase()
            );
            if (metafield?.node?.value) return metafield.node.value;
        }
        if (Array.isArray(product.metafields)) {
            const metafield = product.metafields.find(
                (m: any) => m?.key?.toLowerCase() === key.toLowerCase()
            );
            if (metafield?.value) return metafield.value;
        }
        return null;
    };

    const fabric = getMetafieldValue(product, 'fabric');
    const washCare = getMetafieldValue(product, 'wash_care');
    const refundPolicy =
        getMetafieldValue(product, 'refund_policy') ??
        getMetafieldValue(product, 'Refund Policy');

    // Log all available metafields to debug
    console.log('[PDP] All metafields:', product?.metafields);

    const productSpecifications = getMetafieldValue(product, 'Product Specifications');

    console.log('[PDP] Product specifications found:', productSpecifications);

    // Highlights from metafields (highlight_1..4 or JSON "highlights")
    const highlightsList = useMemo(() => {
        const list: string[] = [];
        const h1 = getMetafieldValue(product, 'highlight_1');
        const h2 = getMetafieldValue(product, 'highlight_2');
        const h3 = getMetafieldValue(product, 'highlight_3');
        const h4 = getMetafieldValue(product, 'highlight_4');
        [h1, h2, h3, h4].forEach((v) => {
            if (v && String(v).trim()) list.push(String(v).trim());
        });
        if (list.length > 0) return list;
        const jsonHighlights = getMetafieldValue(product, 'highlights');
        if (jsonHighlights) {
            try {
                const parsed = JSON.parse(jsonHighlights);
                const arr = Array.isArray(parsed) ? parsed : (parsed?.items ?? parsed?.list ?? []);
                arr.forEach((item: any) => {
                    const s = typeof item === 'string' ? item : (item?.text ?? item?.label ?? item?.value ?? '');
                    if (s) list.push(String(s).trim());
                });
            } catch (_) {
                // single string
                if (String(jsonHighlights).trim()) list.push(String(jsonHighlights).trim());
            }
        }
        return list;
    }, [product]);

    // Price comparison metafields - using exact metafield keys from Shopify
    const priceOnKiddo = getMetafieldValue(product, 'price_on_kiddo');
    const priceOnAmazon = getMetafieldValue(product, 'price_on_amazon');
    const priceOnFirstcry = getMetafieldValue(product, 'price_on_firstcry');
    const priceOnBlinkit = getMetafieldValue(product, 'price_on_blinkit');
    const priceOnZepto = getMetafieldValue(product, 'price_on_zepto');

    // Helper function to format price with rupee symbol
    const formatPriceWithRupee = (price: any) => {
        if (!price || price === '0' || price === 0) return '₹0';
        const priceStr = String(price).trim();
        // If it already starts with ₹, return as is
        if (priceStr.startsWith('₹')) return priceStr;
        // Otherwise, add ₹ prefix
        return `₹${priceStr}`;
    };

    // Check if product has Essentials tag
    const hasEssentialsTag = product?.tags?.some(
        (tag: any) => typeof tag === 'string' && tag.toLowerCase() === 'essentials'
    );

    // Check if product has Gear & Furniture tag
    const hasGearFurnitureTag = product?.tags?.some(
        (tag: any) => typeof tag === 'string' && tag.toLowerCase() === 'gear & furniture'
    );

    // Essentials-only: pack size and size for PDP (same as ProductCard)
    const essentialsMetaParts = useMemo(() => {
        if (!hasEssentialsTag || !product) return { packSize: null, size: null };
        const getVal = (key: string) => getMetafieldValue(product, key);
        const variants = product?.variants?.edges ?? product?.variants ?? [];
        const variant = selectedVariant ?? variants[0]?.node ?? variants[0];
        const options = variant?.selectedOptions ?? [];

        const packSizeRaw =
            getVal('number_of_pieces') ?? getVal('quantity') ?? getVal('pack_size') ?? getVal('number') ??
            (product as any).number_of_pieces ?? (product as any).pack_size;
        const packSizeFromVariant = options.find((o: any) => {
            const name = (o?.name ?? '').toLowerCase().replace(/\s+/g, ' ');
            return ['pack size', 'pack_size', 'count', 'pieces', 'quantity'].some(
                (key) => name === key || name === key.replace('_', ' '),
            );
        })?.value;
        const packSizeStr = (packSizeRaw != null ? String(packSizeRaw).trim() : '') || (packSizeFromVariant ? String(packSizeFromVariant).trim() : '');
        const packSizeLabel = packSizeStr ? `${packSizeStr}${/^\d+$/.test(packSizeStr) ? ' pcs' : ''}` : null;

        const sizeRaw = getVal('size') ?? getVal('sizes') ?? (product as any).size ?? (product as any).sizes;
        const sizeFromVariant = options.find(
            (o: any) => ['size', 'sizes'].includes((o?.name ?? '').toLowerCase()),
        )?.value;
        const sizeLabel = (sizeRaw != null ? String(sizeRaw).trim() : '') || (sizeFromVariant ? String(sizeFromVariant).trim() : '') || null;

        return { packSize: packSizeLabel || null, size: sizeLabel || null };
    }, [hasEssentialsTag, product, selectedVariant]);

    // Show price comparison for all essential products
    // Display "0" for missing values
    const showPriceComparison = hasEssentialsTag;

    // Check if product is a diaper
    const isDiaper = useMemo(() => {
        if (!product) return false;
        const title = (product.title || '').toLowerCase();
        const tags = (product.tags || []).map((tag: any) =>
            typeof tag === 'string' ? tag.toLowerCase() : ''
        );
        return title.includes('diaper') || tags.some((tag: string) => tag.includes('diaper'));
    }, [product]);

    const inWishlist = product ? isInWishlist(product.id) : false;

    const handleWishlistPress = async () => {
        if (wishlistLoading || !product) return;
        setWishlistLoading(true);
        try {
            if (inWishlist) {
                await removeFromWishlist(product.id);
            } else {
                await addToWishlist(product);

                // Track Wishlist Added event
                try {
                    const { trackWishlistAdded } = require('@/utils/mixpanelHelpers');
                    const price = parseFloat(
                        product.priceRange?.minVariantPrice?.amount ||
                        product.variants?.edges?.[0]?.node?.price?.amount ||
                        '0'
                    );
                    trackWishlistAdded(product.id, product.title, price);

                    // Firebase Ecommerce Tracking
                    analyticsService.logAddToWishlist({
                        items: [{
                            item_id: product.id,
                            item_name: product.title,
                            item_category: product.tags?.[0],
                            price: price,
                            quantity: 1,
                        }],
                        value: price,
                        currency: 'INR',
                    });
                } catch (e) {
                    console.warn('[PDP] Wishlist tracking error:', e);
                }
            }
        } catch (error) {
            console.error('Wishlist error:', error);
        } finally {
            setWishlistLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!product) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Product not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{product.title}</Text>
                </View>
                <TouchableOpacity
                    style={styles.shareButton}
                    onPress={handleShare}
                    accessibilityLabel="Share product"
                >
                    <Ionicons name="share-outline" size={24} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.wishlistButton} onPress={handleWishlistPress}>
                    <Ionicons
                        name={inWishlist ? "heart" : "heart-outline"}
                        size={24}
                        color={inWishlist ? Colors.primary : "#000"}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView
                onScroll={handleScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {images.length > 0 && (
                    <GestureHandlerRootView style={styles.imageContainer}>
                        <FlashList
                            {...({
                                ref: imageFlatListRef,
                                data: images,
                                horizontal: true,
                                pagingEnabled: true,
                                showsHorizontalScrollIndicator: false,
                                onScroll: onImageScroll,
                                scrollEventThrottle: 16,
                                onScrollBeginDrag: () => { imageGestureRef.current.isHorizontal = true; },
                                onScrollEndDrag: () => { setTimeout(() => { imageGestureRef.current.isHorizontal = false; }, 100); },
                                estimatedItemSize: SCREEN_WIDTH,
                                renderItem: ({ item }: { item: string }) => (
                                    <TouchableOpacity activeOpacity={1} onPress={handleImagePress} style={styles.imageTouchable}>
                                        <Image source={{ uri: item }} style={styles.mainImage} resizeMode="cover" />
                                    </TouchableOpacity>
                                ),
                            } as any)}
                        />
                        {images.length > 1 && (
                            <View style={styles.imageIndicators}>
                                {images.map((_, index) => (
                                    <View
                                        key={index}
                                        style={[styles.indicator, index === selectedImageIndex && styles.indicatorActive]}
                                    />
                                ))}
                            </View>
                        )}
                        {tryBuyPdpEligible && (
                            <TouchableOpacity style={styles.tryAndBuyTag} onPress={() => setTryAndBuyModalVisible(true)}>
                                <Ionicons name="shirt-outline" size={14} color="#854D0E" />
                                <Text style={styles.tryAndBuyTagText}>Try & Buy</Text>
                            </TouchableOpacity>
                        )}
                    </GestureHandlerRootView>
                )}

                {/* Highlights from metafields - rounded boxes below image; hide when user scrolls down */}
                {highlightsList.length > 0 && (
                    <View style={styles.highlightsSection}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.highlightsScrollContent}
                        >
                            <View style={styles.highlightChipLabelWrap}>
                                <LinearGradient
                                    colors={[Colors.primary, '#FFFFFF']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.highlightChipLabel}
                                >
                                    <Text style={styles.highlightChipLabelText} numberOfLines={1}>Highlights</Text>
                                </LinearGradient>
                            </View>
                            {highlightsList.map((text, index) => (
                                <View key={`highlight-${index}`} style={styles.highlightChip}>
                                    <Text style={styles.highlightChipText} numberOfLines={1}>{text}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}


                <View style={styles.infoContainer}>
                    <View style={styles.sectionCard}>
                        {hasGearFurnitureTag && (
                            <View style={styles.pdpDemoBadgeContainer}>
                                <View style={styles.pdpDemoBadge}>
                                    <Text style={styles.pdpDemoBadgeText}>Demo Available</Text>
                                </View>
                            </View>
                        )}
                        <View style={styles.vendorRow}>
                            {product.vendor ? (
                                <Text style={[
                                    styles.vendorText,
                                    productStyles.vendor && {
                                        fontSize: productStyles.vendor.fontSize,
                                        color: productStyles.vendor.color,
                                        paddingHorizontal: productStyles.vendor.paddingHorizontal,
                                        marginTop: productStyles.vendor.marginTop,
                                        marginBottom: productStyles.vendor.marginBottom,
                                        textTransform: productStyles.vendor.textTransform,
                                        ...processFontStyle(productStyles.vendor, Fonts.LexendMedium),
                                    }
                                ]}>{product.vendor}</Text>
                            ) : null}
                            {(essentialsMetaParts.packSize || essentialsMetaParts.size) ? (
                                <View style={styles.essentialsMetaRow}>
                                    {essentialsMetaParts.packSize ? (
                                        <View style={styles.essentialsMetaBox}>
                                            <Text style={styles.essentialsMetaText} numberOfLines={1}>{essentialsMetaParts.packSize}</Text>
                                        </View>
                                    ) : null}
                                    {essentialsMetaParts.size ? (
                                        <View style={styles.essentialsMetaBox}>
                                            <Text style={styles.essentialsMetaText} numberOfLines={1}>{essentialsMetaParts.size}</Text>
                                        </View>
                                    ) : null}
                                </View>
                            ) : null}
                        </View>
                        <Text style={[
                            styles.title,
                            productStyles.title && {
                                fontSize: productStyles.title.fontSize,
                                color: productStyles.title.color,
                                paddingHorizontal: productStyles.title.paddingHorizontal,
                                paddingTop: productStyles.title.paddingTop,
                                lineHeight: productStyles.title.lineHeight,
                                ...processFontStyle(productStyles.title, Fonts.FredokaSemiBold),
                            }
                        ]}>{product.title}</Text>


                        {tryBuyPdpEligible && pdpMainTryBuyOption ? (
                            <TryBuyPdpVariantSection
                                productVariants={variants}
                                mainOption={pdpMainTryBuyOption}
                                primaryValue={selectedOptions[pdpMainTryBuyOption.name]}
                                onSelectPrimary={(v) => handleOptionSelect(pdpMainTryBuyOption.name, v)}
                                tryValue={pdpTrySizeValue}
                                onTryValueChange={setPdpTrySizeValue}
                            />
                        ) : null}

                        {/* Price Section */}
                        <View style={styles.productPriceContainer}>

                            <View style={styles.productPriceRow}>
                                <Text style={styles.productPriceText}>{formattedPrice}</Text>
                                {formattedMRP && (
                                    <Text style={styles.productMrpText}>{formattedMRP}</Text>
                                )}
                                {discountPercentage !== null && (
                                    <Text style={styles.productSavingsText}>{discountPercentage}% off</Text>
                                )}
                            </View>
                        </View>


                        {productOptions.length > 0 && (
                            <View style={styles.variantsContainer}>
                                {(tryBuyPdpEligible ? pdpRestProductOptions : productOptions).map((option: any) => (
                                    <View key={option.name} style={styles.optionContainer}>
                                        <Text style={[
                                            styles.optionLabel,
                                            productStyles.variantLabel && {
                                                fontSize: productStyles.variantLabel.fontSize,
                                                color: productStyles.variantLabel.color,
                                                ...processFontStyle(productStyles.variantLabel, Fonts.SemiBold),
                                            }
                                        ]}>
                                            {option.name}{selectedOptions[option.name] ? `: ${selectedOptions[option.name]}` : ''}
                                        </Text>
                                        <View style={styles.variantsList}>
                                            {(() => {
                                                const availableValues: string[] = [];
                                                const unavailableValues: string[] = [];

                                                option.values.forEach((value: string) => {
                                                    const isAvail = variants.some((variant: any) => {
                                                        if (!variant.selectedOptions) return false;
                                                        return variant.selectedOptions.some(
                                                            (opt: any) => opt.name === option.name && opt.value === value
                                                        ) && isVariantAvailable(variant) !== false;
                                                    });
                                                    if (isAvail) availableValues.push(value);
                                                    else unavailableValues.push(value);
                                                });

                                                return [...availableValues, ...unavailableValues].map((value: string) => {
                                                    const isSelected = selectedOptions[option.name] === value;
                                                    const isOptionAvailable = availableValues.includes(value);

                                                    return (
                                                        <TouchableOpacity
                                                            key={value}
                                                            style={[
                                                                styles.variantButton,
                                                                isSelected && styles.variantButtonActive,
                                                                !isOptionAvailable && styles.variantButtonDisabled
                                                            ]}
                                                            onPress={() => handleOptionSelect(option.name, value)}
                                                            disabled={!isOptionAvailable}
                                                        >
                                                            <Text style={[
                                                                styles.variantText,
                                                                isSelected && styles.variantTextActive,
                                                                !isOptionAvailable && styles.variantTextDisabled,
                                                                productStyles.variantButton && !isSelected && {
                                                                    fontSize: productStyles.variantButton.fontSize,
                                                                    color: productStyles.variantButton.color,
                                                                    ...processFontStyle(productStyles.variantButton, Fonts.Medium),
                                                                }
                                                            ]}>
                                                                {value}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                });
                                            })()}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Date Selection - Only show for ticketing products (Events, Playhouses, Petting Farms) */}
                        {isTicketingProduct && (
                            <View style={styles.dateSelectionContainer}>
                                <View style={styles.dateLabelContainer}>
                                    <Text style={styles.dateSelectionLabel}>Select Date</Text>
                                    <Text style={styles.requiredAsterisk}>*</Text>
                                </View>
                                <TouchableOpacity
                                    style={[
                                        styles.dateSelectionButton,
                                        !selectedEventDate && showDateError && styles.dateSelectionButtonError
                                    ]}
                                    onPress={() => {
                                        setShowDatePicker(true);
                                        setShowDateError(false); // Clear error when user opens date picker
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="calendar-outline" size={20} color={Colors.text} style={styles.dateIcon} />
                                    <Text style={[styles.dateSelectionText, !selectedEventDate && styles.dateSelectionPlaceholder]}>
                                        {selectedEventDate
                                            ? selectedEventDate.toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })
                                            : 'Select a date'
                                        }
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* 7 Days Easy Returns Bar */}
                    <ProductTrustStrip
                        refundPolicyText={refundPolicy}
                        onKnowMorePress={() => setShowRefundPolicyModal(true)}
                    />

                    {/* Product Specifications */}
                    {(product.description || productSpecifications) && (
                        <View style={styles.sectionCard}>
                            <Text style={styles.productDescriptionTitle}>Product Specifications</Text>
                            <View style={styles.specsDescRow}>
                                {/* Specifications Column */}
                                <View style={styles.specsColumn}>
                                    <Text style={styles.columnTitle}>Specifications</Text>
                                    {productSpecifications ? (() => {
                                        console.log('[PDP] Product specifications raw:', productSpecifications);
                                        try {
                                            const specs = JSON.parse(productSpecifications);
                                            console.log('[PDP] Parsed specs:', specs);
                                            return Object.entries(specs).map(([key, value]) => (
                                                <View key={key} style={styles.specItem}>
                                                    <Text style={styles.specKey}>{key}:</Text>
                                                    <Text style={styles.specValue}>{String(value)}</Text>
                                                </View>
                                            ));
                                        } catch (e) {
                                            console.error('[PDP] Failed to parse product specifications:', e);
                                            return null;
                                        }
                                    })() : (
                                        <Text style={styles.noSpecsText}>No specifications available</Text>
                                    )}
                                </View>
                                {/* Description Column */}
                                <View style={styles.descColumn}>
                                    <Text style={styles.columnTitle}>Description</Text>
                                    {product.description && (
                                        <Text style={[
                                            styles.productDescriptionText,
                                            productStyles.description && {
                                                fontSize: productStyles.description.fontSize,
                                                color: productStyles.description.color,
                                                lineHeight: productStyles.description.lineHeight,
                                                ...processFontStyle(productStyles.description, Fonts.FredokaSemiBold),
                                            }
                                        ]}>{product.description}</Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Demo Available Section for Gear & Furniture */}
                    {hasGearFurnitureTag && (
                        <View style={styles.demoSection}>
                            <Text style={styles.demoSectionTitle}>Experience it at home</Text>
                            <Image
                                source={{ uri: DEMO_PDP_CONFIG.imageUrl }}
                                style={styles.demoImage}
                                resizeMode="cover"
                            />
                            <View style={styles.demoContent}>
                                <View style={styles.demoBulletPoints}>
                                    {DEMO_PDP_CONFIG.bulletPoints.map((point: string, index: number) => (
                                        <View key={index} style={styles.demoBulletPoint}>
                                            <Text style={styles.demoBulletText}>• {point}</Text>
                                        </View>
                                    ))}
                                </View>
                                <TouchableOpacity
                                    style={[
                                        styles.requestDemoButton,
                                        selectedVariant && isVariantAvailable(selectedVariant) === false && styles.disabledButton
                                    ]}
                                    onPress={() => {
                                        // Check if product is out of stock before allowing demo booking
                                        if (selectedVariant && isVariantAvailable(selectedVariant) === false) {
                                            Alert.alert('Out of Stock', 'This product is currently out of stock and cannot be booked for a demo.');
                                            return;
                                        }
                                        router.push({
                                            pathname: '/demo/get-demo',
                                            params: {
                                                productId: product.id,
                                                variantId: selectedVariant?.id || product.id,
                                                productTitle: product.title,
                                                productPrice: basePrice.toFixed(0),
                                                productComparePrice: mrp.toFixed(0),
                                                productDiscount: discountPercentage || 0,
                                                productImage: images[0] || '',
                                            }
                                        });
                                    }}
                                    disabled={selectedVariant && isVariantAvailable(selectedVariant) === false}
                                >
                                    <Text style={[
                                        styles.requestDemoButtonText,
                                        selectedVariant && isVariantAvailable(selectedVariant) === false && { opacity: 0.5 }
                                    ]}>REQUEST A DEMO</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Price Comparison Chart - Display right after description */}
                    {showPriceComparison && (
                        <View style={[styles.sectionCard, styles.priceComparisonContainer]}>
                            <Text style={styles.priceComparisonTitle}>Best Prices Guaranteed</Text>
                            <View style={styles.priceComparisonTable}>
                                {/* Header Row */}
                                <View style={[styles.priceComparisonRow, styles.priceComparisonHeaderRow]}>
                                    <Text style={styles.pricePlatformTextHeader}>Platform</Text>
                                    <Text style={styles.priceValueTextHeader}>
                                        {isDiaper ? 'Price per diaper' : 'Price'}
                                    </Text>
                                </View>
                                <View style={styles.priceComparisonRow}>
                                    <Text style={styles.pricePlatformText}>Amazon</Text>
                                    <Text style={styles.priceValueText}>{formatPriceWithRupee(priceOnAmazon)}</Text>
                                </View>
                                <View style={styles.priceComparisonRow}>
                                    <Text style={styles.pricePlatformText}>FirstCry</Text>
                                    <Text style={styles.priceValueText}>{formatPriceWithRupee(priceOnFirstcry)}</Text>
                                </View>
                                <View style={styles.priceComparisonRow}>
                                    <Text style={styles.pricePlatformText}>Blinkit</Text>
                                    <Text style={styles.priceValueText}>{formatPriceWithRupee(priceOnBlinkit)}</Text>
                                </View>
                                <View style={styles.priceComparisonRow}>
                                    <Text style={styles.pricePlatformText}>Zepto</Text>
                                    <Text style={styles.priceValueText}>{formatPriceWithRupee(priceOnZepto)}</Text>
                                </View>
                                <View style={[styles.priceComparisonRow, styles.priceComparisonRowKiddo]}>
                                    <View style={styles.kiddoRowContent}>
                                        <Ionicons name="star" size={12} color="#FFD700" style={styles.starIcon} />
                                        <Text style={styles.pricePlatformTextKiddo}>Kiddo</Text>
                                        <Ionicons name="star" size={12} color="#FFD700" style={styles.starIcon} />
                                    </View>
                                    <Text style={styles.priceValueTextKiddo}>{formatPriceWithRupee(priceOnKiddo)}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {recommendationsConfig.enabled !== false && renderProductSection(
                        recommendedProducts,
                        recommendationsConfig,
                        "You May Also Like"
                    )}

                    {recentlyViewedConfig.enabled !== false && renderProductSection(
                        recentlyViewedProducts,
                        recentlyViewedConfig,
                        "Recently Viewed"
                    )}
                </View>
            </ScrollView>

            <BlurView
                intensity={100}
                tint="light"
                style={[
                    styles.bottomBar,
                    { paddingBottom: Math.max(insets.bottom, 20) },
                    hasGearFurnitureTag && { flexDirection: 'column', alignItems: 'stretch' }
                ]}
            >
                <View style={[styles.priceContainer, hasGearFurnitureTag && { marginBottom: 12 }]}>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceText}>{formattedPrice}</Text>
                        {formattedMRP && (
                            <Text style={styles.mrpText}>{formattedMRP}</Text>
                        )}
                        {discountPercentage !== null && (
                            <Text style={styles.savingsText}>{discountPercentage}% off</Text>
                        )}
                    </View>
                </View>

                {(() => {
                    const cartButtonNode = selectedVariant && isVariantAvailable(selectedVariant) === true ? (
                        isTicketingProduct && !selectedEventDate ? (
                            <TouchableOpacity
                                style={[styles.addToCartButton]}
                                onPress={() => {
                                    setShowDatePicker(true);
                                    setShowDateError(false); // Clear error when user opens date picker
                                }}
                            >
                                <Text style={styles.addToCartText}>Select Date</Text>
                            </TouchableOpacity>
                        ) : (
                            <UniversalAdd
                                item={product}
                                selectedVariant={selectedVariant}
                                variant="pdp"
                                addText="Add to Cart"
                                bookingDate={isTicketingProduct ? selectedEventDate : undefined}
                                isTicketing={isTicketingProduct}
                                tryBuyTrialVariant={tryBuyPdpEligible ? pdpResolvedTryVariant : undefined}
                                pdpAddBlocked={
                                    tryBuyPdpEligible &&
                                    !!pdpMainTryBuyOption &&
                                    !selectedOptions[pdpMainTryBuyOption.name]
                                }
                                onValidationError={() => {
                                    if (isTicketingProduct && !selectedEventDate) {
                                        setShowDateError(true);
                                    }
                                }}
                            />
                        )
                    ) : (
                        <TouchableOpacity
                            style={[styles.addToCartButton, styles.disabledButton]}
                            disabled={true}
                        >
                            <Text style={styles.addToCartText}>Out of Stock</Text>
                        </TouchableOpacity>
                    );

                    if (hasGearFurnitureTag) {
                        return (
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    {cartButtonNode}
                                </View>
                                <TouchableOpacity
                                    style={[
                                        styles.bookDemoButton,
                                        selectedVariant && isVariantAvailable(selectedVariant) === false && styles.disabledButton
                                    ]}
                                    onPress={() => {
                                        // Check if product is out of stock before allowing demo booking
                                        if (selectedVariant && isVariantAvailable(selectedVariant) === false) {
                                            Alert.alert('Out of Stock', 'This product is currently out of stock and cannot be booked for a demo.');
                                            return;
                                        }
                                        router.push({
                                            pathname: '/demo/get-demo',
                                            params: {
                                                productId: product.id,
                                                variantId: selectedVariant?.id || product.id,
                                                productTitle: product.title,
                                                productPrice: basePrice.toFixed(0),
                                                productComparePrice: mrp.toFixed(0),
                                                productDiscount: discountPercentage || 0,
                                                productImage: images[0] || '',
                                            }
                                        });
                                    }}
                                    disabled={selectedVariant && isVariantAvailable(selectedVariant) === false}
                                >
                                    <Text style={[
                                        styles.bookDemoButtonText,
                                        selectedVariant && isVariantAvailable(selectedVariant) === false && { opacity: 0.5 }
                                    ]}>Book a demo</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    }

                    return cartButtonNode;
                })()}
            </BlurView>

            <TryAndBuyModal visible={tryAndBuyModalVisible} onClose={() => setTryAndBuyModalVisible(false)} />
            <ImageViewerModal
                visible={imageViewerVisible}
                images={images}
                initialIndex={selectedImageIndex}
                onClose={() => setImageViewerVisible(false)}
            />

            {/* Date Picker Modal */}
            {isTicketingProduct && (
                <BaseModal
                    visible={showDatePicker}
                    onClose={() => setShowDatePicker(false)}
                    title="Select Date"
                    type="bottomSheet"
                >
                    <EventDatePicker
                        selectedDate={selectedEventDate}
                        onDateSelect={handleDateSelectAndAddToCart}
                        // Events: pass predefined variant dates. Others: undefined → falls back to next 7 days.
                        availableDates={isEventsProduct ? (availableDates ?? []) : undefined}
                    />
                </BaseModal>
            )}

            <BaseModal
                visible={showRefundPolicyModal}
                onClose={() => setShowRefundPolicyModal(false)}
                title="Return Policy"
                type="bottomSheet"
            >
                <Text style={styles.refundPolicyModalText}>
                    {refundPolicy?.trim() || '7-Day Easy Returns'}
                </Text>
            </BaseModal>

            <FloatingCartButton showTabBar={false} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        zIndex: 10,
    },
    backButton: {
        padding: 8,
    },
    headerTitleContainer: {
        flex: 1,
        marginHorizontal: 10,
    },
    headerTitle: {
        fontSize: 16,
        fontFamily: Fonts.FredokaSemiBold,
        color: '#000',
    },
    shareButton: {
        padding: 8,
    },
    wishlistButton: {
        padding: 8,
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        paddingBottom: 100,
        backgroundColor: '#f5f5f5',
    },
    /** White elevated card on soft background (PDP sections) */
    sectionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 8,
        paddingTop: 16,
        paddingBottom: 16,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    /** Horizontal lists / grids set their own horizontal padding — avoid double inset */
    sectionCardEmbedList: {
        paddingHorizontal: 0,
        /** Match vertical padding above title and below list inside the white card */
        paddingTop: 16,
        paddingBottom: 16,
    },
    imageContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
        backgroundColor: '#f5f5f5',
    },
    imageTouchable: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
    },
    mainImage: {
        width: '100%',
        height: '100%',
    },
    imageIndicators: {
        position: 'absolute',
        bottom: 20,
        flexDirection: 'row',
        alignSelf: 'center',
    },
    indicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(0,0,0,0.2)', // Improved visibility on white/light backgrounds
        marginHorizontal: 4,
    },
    indicatorActive: {
        backgroundColor: Colors.primary, // Active color matches brand
        width: 20,
    },
    tryAndBuyTag: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF9C3',
        borderWidth: 1,
        borderColor: '#FDE047',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    tryAndBuyTagText: {
        color: '#854D0E',
        fontSize: 12,
        fontFamily: Fonts.LexendSemiBold,
        marginLeft: 4,
    },
    demoSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 8,
        paddingTop: 16,
        paddingBottom: 16,
        paddingHorizontal: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    demoSectionTitle: {
        fontSize: 18,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
        marginBottom: 12,
    },
    demoImage: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        marginBottom: 8,
    },
    demoContent: {
        marginTop: 8,
    },
    demoSubsectionTitle: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
        marginBottom: 8,
    },
    demoBulletPoints: {
        marginTop: 8,
    },
    demoBulletPoint: {
        marginBottom: 6,
    },
    demoBulletText: {
        fontSize: 13,
        fontFamily: Fonts.LexendRegular,
        color: Colors.textSecondary,
        lineHeight: 18,
    },
    requestDemoButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
        marginTop: 16,
        alignItems: 'center',
        borderColor: Colors.primary,
        borderWidth: 1

    },
    requestDemoButtonText: {
        color: Colors.primary,
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        fontWeight: '600',
    },
    infoContainer: {
        paddingTop: 10,
    },
    title: {
        fontSize: 20,
        fontFamily: Fonts.FredokaSemiBold,
        paddingHorizontal: 16,
        paddingTop: 0,
        marginTop: 0,
        lineHeight: 28,
    },
    pdpDemoBadgeContainer: {
        paddingHorizontal: 16,
        alignItems: 'flex-start',
        marginBottom: 2,
    },
    pdpDemoBadge: {
        backgroundColor: '#FEF7C3',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    pdpDemoBadgeText: {
        color: '#CA8504',
        fontSize: 11,
        fontFamily: Fonts.Bold,
    },
    vendorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
        marginBottom: 0,
        paddingHorizontal: 16,
    },
    vendorText: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#666',
        /** Align with product title: inset comes from `vendorRow` only (avoid double padding) */
        paddingHorizontal: 0,
        marginTop: 0,
        marginBottom: 0,
        textTransform: 'uppercase',
        /** Tighten uppercase brand (e.g. SNUGBUG) — Lexend can look wide */
        letterSpacing: -0.6,
    },
    variantsContainer: {
        paddingHorizontal: 16, // Reduced padding
        marginTop: 28,
        marginBottom: 0,
    },
    optionContainer: {
        marginBottom: 12,
    },
    optionLabel: {
        fontSize: 16,
        color: '#333',
        marginBottom: 12,
        fontFamily: Fonts.SemiBold,
    },
    variantsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    variantButton: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#fff',
        minWidth: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    variantButtonActive: {
        borderColor: Colors.variantSelection,
        backgroundColor: '#FEEFEF',
    },
    variantButtonDisabled: {
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        opacity: 0.5,
    },
    variantText: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
    },
    variantTextActive: {
        color: Colors.variantSelection,
        fontFamily: Fonts.LexendSemiBold,
    },
    variantTextDisabled: {
        color: '#9CA3AF',
    },
    dateSelectionContainer: {
        paddingHorizontal: 16,
        marginTop: 20,
        marginBottom: 4,
    },
    dateLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    dateSelectionLabel: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
        marginRight: 4,
    },
    requiredAsterisk: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#FF4444',
    },
    dateSelectionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    dateIcon: {
        marginRight: 10,
    },
    dateSelectionText: {
        flex: 1,
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.text,
    },
    dateSelectionPlaceholder: {
        color: Colors.textSecondary,
    },
    dateSelectionButtonError: {
        borderColor: '#EF4444', // Red color for error state
        borderWidth: 1.5,
    },
    separator: {
        height: 8,
        backgroundColor: '#F9F9F9', // Light gray gap
        marginTop: 24, // Space above
        marginBottom: 8, // Space below
    }, // Kept for reuse; main PDP uses sectionCard spacing instead
    highlightsSection: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    highlightsScrollContent: {
        flexDirection: 'row',
        gap: 8,
        paddingRight: 16,
    },
    highlightChipLabelWrap: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    highlightChipLabel: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    highlightChipLabelText: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
    },
    highlightChip: {
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    highlightChipText: {
        fontSize: 12,
        fontFamily: Fonts.Medium,
        color: '#363636',
    },
    essentialsMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    essentialsMetaBox: {
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    essentialsMetaText: {
        fontSize: 10,
        fontFamily: Fonts.SemiBold,
        color: '#1565C0',
        lineHeight: 14,
    },
    /** Layout only — must not set backgroundColor (would override sectionCard white) */
    accordionContainer: {
        borderBottomWidth: 0,
        marginHorizontal: 0,
    },
    accordionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    accordionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    accordionIcon: {
        marginRight: 12,
        color: '#666',
    },
    accordionTitle: {
        fontSize: 16,
        fontFamily: Fonts.FredokaSemiBold,
        color: '#1a1a1a',
    },
    accordionContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    descriptionContainer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
    },
    descriptionBody: {
        fontSize: 14,
        color: '#4a4a4a',
        lineHeight: 24,
        fontFamily: Fonts.FredokaSemiBold,
    },
    specValue: {
        fontSize: 14,
        color: '#4a4a4a',
        fontFamily: Fonts.FredokaSemiBold,
        lineHeight: 24,
        textAlign: 'left',
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        backgroundColor: 'transparent',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.08)',
        alignItems: 'center',
    },
    priceContainer: {
        flex: 1,
        flexDirection: 'column',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    priceText: {
        fontSize: 18,
        fontFamily: Fonts.FredokaSemiBold,
        color: Colors.text,
    },
    mrpText: {
        fontSize: 14,
        fontFamily: Fonts.FredokaSemiBold,
        color: '#999',
        textDecorationLine: 'line-through',
    },
    savingsText: {
        fontSize: 12,
        fontFamily: Fonts.FredokaSemiBold,
        color: '#4CAF50',
    },
    productPriceContainer: {
        marginTop: 12,
        marginBottom: 8,
        paddingLeft: 16,
    },
    productPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    productPriceText: {
        fontSize: 24,
        fontFamily: Fonts.FredokaSemiBold,
        color: Colors.text,
    },
    productMrpText: {
        fontSize: 18,
        fontFamily: Fonts.FredokaSemiBold,
        color: '#999',
        textDecorationLine: 'line-through',
    },
    productSavingsText: {
        fontSize: 14,
        fontFamily: Fonts.FredokaSemiBold,
        color: '#4CAF50',
    },
    bookDemoButton: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderColor: '#D5D7DA',
        borderWidth: 1,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
    },
    bookDemoButtonText: {
        color: Colors.primary,
        fontFamily: Fonts.FredokaSemiBold,
        fontSize: 18,
    },
    refundPolicyModalText: {
        fontSize: 14,
        lineHeight: 22,
        fontFamily: Fonts.LexendRegular,
        color: Colors.text,
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    priceComparisonContainer: {
        marginTop: 8,
        marginBottom: 0,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    productDescriptionTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        marginBottom: 12,
    },
    specsDescRow: {
        flexDirection: 'row',
        gap: 16,
    },
    specsColumn: {
        flex: 1,
    },
    descColumn: {
        flex: 1,
    },
    columnTitle: {
        fontSize: 16,
        fontFamily: Fonts.FredokaSemiBold,
        color: Colors.text,
        marginBottom: 8,
    },
    specItem: {
        marginBottom: 8,
    },
    specKey: {
        fontSize: 14,
        fontFamily: Fonts.FredokaSemiBold,
        color: Colors.text,
    },
    noSpecsText: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
        fontStyle: 'italic',
    },
    productDescriptionText: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.text,
        lineHeight: 22,
    },
    priceComparisonTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 16,
    },
    priceComparisonTable: {
        backgroundColor: Colors.backgroundWhite,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    priceComparisonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    priceComparisonHeaderRow: {
        backgroundColor: '#F5F5F5',
        borderBottomWidth: 2,
        borderBottomColor: Colors.border,
        paddingVertical: 12,
    },
    priceComparisonRowKiddo: {
        backgroundColor: '#E8F5E9',
        borderBottomWidth: 0,
    },
    kiddoRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    starIcon: {
        marginHorizontal: 2,
    },
    pricePlatformText: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.text,
    },
    pricePlatformTextHeader: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    pricePlatformTextKiddo: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
    },
    priceValueText: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.text,
    },
    priceValueTextHeader: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    priceValueTextKiddo: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    addToCartButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        minWidth: 140,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    addToCartText: {
        color: '#fff',
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
    },
    retryButton: {
        marginTop: 20,
        padding: 12,
        backgroundColor: Colors.primary,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontFamily: Fonts.Bold,
    },
    recommendationsGap: {
        height: 0,
        backgroundColor: 'transparent',
        marginTop: 0,
    },
});

export default ProductDetailScreen;

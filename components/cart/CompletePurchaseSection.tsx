import HorizontalProductList from '@/components/content/HorizontalProductList';
import { Fonts } from '@/constants/theme';
import { shopifyApi } from '@/services/shopifyApi';
import { useCartStore } from '@/store/cartStore';
import { isProductAvailable, sortInStockFirst } from '@/utils/availability';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { appConfigService } from '@/services/appConfigService';

const DEFAULT_COLLECTION_ID = 'gid://shopify/Collection/511203115297';
const FETCH_LIMIT = 250;

export function CompletePurchaseSection() {
    const cartItems = useCartStore(s => s.lineItems);

    const collectionId = useMemo(() => {
        const config = appConfigService.getConfig();
        return config?.completePurchase || config?.cart?.completePurchase || "";
    }, []);

    // Fetch a large number of products. Added FETCH_LIMIT to queryKey to bust the previous cache.
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['complete_purchase', collectionId, FETCH_LIMIT],
        queryFn: async () => {
            const result = await shopifyApi.getProductsByCollection(collectionId, FETCH_LIMIT);
            return result?.products?.edges?.map((e: any) => e.node).filter(Boolean) || [];
        },
        staleTime: 1000 * 60 * 5,
    });

    // Filter out out-of-stock items
    const filteredProducts = useMemo(() => {
        let list = products.filter(p => isProductAvailable(p));
        return sortInStockFirst(list); // Pass all in-stock products without slicing
    }, [products]);

    if (!isLoading && filteredProducts.length === 0) {
        return null;
    }

    const wrapperStyle = (!isLoading && filteredProducts.length > 0) ? styles.section : styles.hidden;

    return (
        <View style={wrapperStyle}>
            {!isLoading && filteredProducts.length > 0 && <Text style={styles.title}>Complete your purchase with</Text>}
            <HorizontalProductList
                products={filteredProducts}
                config={{ itemsPerView: 2.5, sidePadding: 8, itemSpacing: 12 }}
                title=""
                onlyInStock={true}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    hidden: {
        position: 'absolute',
        opacity: 0,
        pointerEvents: 'none',
        width: 1,
        height: 1,
        overflow: 'hidden',
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingTop: 16,
        paddingHorizontal: 8,
        marginBottom: 12,
    },
    title: {
        fontSize: Fonts.SmallFontSize,
        color: '#717680',
        fontFamily: Fonts.LexendBold,
        marginBottom: 12,
        textAlign: 'left',
        paddingLeft: 8,
    },
});

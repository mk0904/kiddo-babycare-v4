import HorizontalProductList from '@/components/content/HorizontalProductList';
import { Fonts } from '@/constants/theme';
import { useCartStore } from '@/store/cartStore';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

const COMPLETE_PURCHASE_COLLECTION_ID = 'gid://shopify/Collection/508646719777';

export function CompletePurchaseSection() {
    const router = useRouter();
    const [hasProducts, setHasProducts] = useState<boolean | null>(null);

    const handleProductsLoaded = (products: any[]) => {
        setHasProducts(products.length > 0);
    };

    const list = (
        <HorizontalProductList
            collectionIds={[COMPLETE_PURCHASE_COLLECTION_ID]}
            config={{ limit: 8, itemsPerView: 2.5, sidePadding: 8, itemSpacing: 12 }}
            title=""
            onProductsLoaded={handleProductsLoaded}
            onProductPress={(p) => p?.id && router.push({ pathname: '/product/[id]', params: { id: p.id } } as any)}
            onAddToCart={(p) => {
                if (p?.variants?.edges?.[0]?.node) {
                    const v = p.variants.edges[0].node;
                    useCartStore.getState().addItem({
                        productId: p.id,
                        variantId: v.id,
                        title: p.title,
                        variantTitle: v.title,
                        price: parseFloat(v.price?.amount || '0'),
                        compareAtPrice: v.compareAtPrice?.amount ? parseFloat(v.compareAtPrice.amount) : undefined,
                        currencyCode: v.price?.currencyCode || 'INR',
                        image: p.featuredImage?.url || v.image?.url || '',
                        quantity: 1,
                        availableForSale: v.availableForSale !== false,
                        tags: p.tags || [],
                    });
                }
            }}
        />
    );

    if (hasProducts === false) {
        return null;
    }

    const wrapperStyle = hasProducts === true ? styles.section : styles.hidden;
    return (
        <View style={wrapperStyle}>
            {hasProducts === true && <Text style={styles.title}>Complete your purchase with</Text>}
            {list}
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
        paddingVertical: 16,
        paddingHorizontal: 8,
        paddingLeft: 8,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    title: {
        fontSize: 15,
        color: '#2D2D2D',
        fontFamily: Fonts.Bold,
        marginBottom: 12,
        textAlign: 'left',
        paddingLeft: 8,
    },
});

import UniversalAdd from '@/components/ui/UniversalAdd';
import { Colors } from '@/constants/theme';
import { useWishlist } from '@/context/WishlistContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface ProductImageActionsProps {
  product: any;
}

export function ProductImageActions({ product }: ProductImageActionsProps) {
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const productId = useMemo(
    () => product?.id || product?._id || product?.handle,
    [product?.id, product?._id, product?.handle],
  );

  const inWishlist = useMemo(
    () => (productId ? isInWishlist(productId) : false),
    [isInWishlist, productId],
  );

  const handleWishlistPress = useCallback(
    async (e: any) => {
      e?.stopPropagation?.();
      if (!productId || wishlistLoading) return;

      if (process.env.EXPO_OS === 'ios') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      setWishlistLoading(true);
      try {
        if (inWishlist) {
          removeFromWishlist(productId);
        } else {
          addToWishlist(product);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setWishlistLoading(false);
      }
    },
    [wishlistLoading, inWishlist, productId, removeFromWishlist, addToWishlist, product],
  );

  if (!product) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.wishlistButton}
        onPress={handleWishlistPress}
        disabled={wishlistLoading}
        activeOpacity={0.7}
      >
        <Ionicons
          name={inWishlist ? 'heart' : 'heart-outline'}
          size={16}
          color={inWishlist ? '#ff4444' : Colors.text}
        />
      </TouchableOpacity>
      <View style={styles.addButtonContainer} pointerEvents="auto" collapsable={false}>
        <UniversalAdd item={product} variant="prominent" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 6,
    zIndex: 10,
  },
  addButtonContainer: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    zIndex: 10,
  },
});

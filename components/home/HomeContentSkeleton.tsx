import SkeletonLoader, { HorizontalProductListSkeleton, ProductCardSkeleton } from '@/components/ui/SkeletonLoader';
import { Dimensions, StyleSheet, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function HomeContentSkeleton() {
  return (
    <View style={styles.container}>
      {/* Banner Skeleton */}
      <SkeletonLoader variant="default" height={SCREEN_WIDTH * 0.8} width="100%" style={styles.banner} />
      
      {/* Category Grid Skeleton */}
      <View style={styles.categoryGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={styles.categoryItem}>
            <SkeletonLoader variant="circle" width={60} height={60} />
            <SkeletonLoader variant="text" height={12} width="100%" style={styles.categoryLabel} />
          </View>
        ))}
      </View>

      {/* Horizontal Product List Skeleton */}
      <View style={styles.section}>
        <SkeletonLoader variant="text" height={20} width="40%" style={styles.sectionTitle} />
        <HorizontalProductListSkeleton count={3} />
      </View>

      {/* Product Grid Skeleton */}
      <View style={styles.section}>
        <SkeletonLoader variant="text" height={20} width="40%" style={styles.sectionTitle} />
        <View style={styles.productGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} width={`${(SCREEN_WIDTH - 48) / 2}px`} />
          ))}
        </View>
      </View>

      {/* Another Horizontal List */}
      <View style={styles.section}>
        <SkeletonLoader variant="text" height={20} width="40%" style={styles.sectionTitle} />
        <HorizontalProductListSkeleton count={3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  banner: {
    marginBottom: 16,
    borderRadius: 20,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  categoryItem: {
    width: (SCREEN_WIDTH - 48) / 3,
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryLabel: {
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});

import { Colors, Fonts } from '@/constants/theme';
import { configService } from '@/services/configService';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

interface FreeShoesOfferProps {
  visible?: boolean;
  /** HEYKIDDO coupon from backend - only source for coupon code/values */
  heykiddoCoupon?: { code?: string; minimumPurchaseAmount?: string | number | null } | null;
}

const FreeShoesOffer: React.FC<FreeShoesOfferProps> = ({ visible = true, heykiddoCoupon }) => {
  if (!visible) return null;

  const [failedIds, setFailedIds] = React.useState<Set<string>>(new Set());
  const [shoeOptions, setShoeOptions] = React.useState<Array<{ id: string; name: string; imageUrl: string }>>([]);
  const [couponCode, setCouponCode] = React.useState<string>('');
  const [minimumPurchase, setMinimumPurchase] = React.useState<number | null>(null);

  // Load shoe options and coupon info from config
  React.useEffect(() => {
    const loadConfig = () => {
      try {
        // Load shoe options
        const freeShoesConfig = configService.getFreeShoesOfferConfig();
        if (freeShoesConfig && freeShoesConfig.enabled && freeShoesConfig.shoes && freeShoesConfig.shoes.length > 0) {
          setShoeOptions(freeShoesConfig.shoes);
        } else {
          setShoeOptions([]);
        }

        // Load coupon code from backend only (no config fallback)
        if (heykiddoCoupon?.code) {
          setCouponCode(heykiddoCoupon.code);
          setMinimumPurchase(
            heykiddoCoupon.minimumPurchaseAmount != null
              ? (typeof heykiddoCoupon.minimumPurchaseAmount === 'string'
                  ? parseFloat(heykiddoCoupon.minimumPurchaseAmount)
                  : heykiddoCoupon.minimumPurchaseAmount)
              : null
          );
        } else {
          setCouponCode('');
          setMinimumPurchase(null);
        }
      } catch (error) {
        console.error('[FreeShoesOffer] Error loading config:', error);
        setShoeOptions([]);
      }
    };

    loadConfig();
  }, [heykiddoCoupon]);

  const handleImageError = React.useCallback((id: string) => {
    setFailedIds((prev) => new Set(prev).add(id));
  }, []);

  // Prefetch shoe images so they appear faster when the offer is visible.
  React.useEffect(() => {
    shoeOptions.forEach((s) => {
      Image.prefetch(s.imageUrl).catch(() => {});
    });
  }, [shoeOptions]);

  return (
    <View style={styles.container}>
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeText}>Introductory Offer</Text>
      </View>
      
      <View style={styles.titleRow}>
        <View style={styles.titleTextBlock}>
          <Text style={styles.title}>Get free shoes on first apparel order</Text>
          <Text style={styles.subtitle}>For Limited Customers Only</Text>
        </View>
      </View>

      {/* Coupon Code Line */}
      {couponCode && (
        <View style={styles.couponCodeRow}>
          <Text style={styles.couponCodeText}>Use coupon code </Text>
          <Text style={styles.couponCode}>{couponCode}</Text>
        </View>
      )}

      {shoeOptions.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.carousel} 
          contentContainerStyle={styles.carouselContent}
        >
          {shoeOptions.map((shoe) => (
          <View key={shoe.id} style={styles.imageBox}>
            {failedIds.has(shoe.id) ? (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={32} color="#ccc" />
              </View>
            ) : (
              <Image
                source={{ uri: shoe.imageUrl }}
                style={styles.shoeImage}
                contentFit="cover"
                placeholder={BLURHASH}
                placeholderContentFit="cover"
                cachePolicy="memory-disk"
                priority="high"
                transition={150}
                recyclingKey={shoe.id}
                onError={() => handleImageError(shoe.id)}
              />
            )}
          </View>
        ))}
        </ScrollView>
      )}

      {/* Additional Points */}
      <View style={styles.pointsContainer}>
        <View style={styles.pointRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.pointText}>Kiddo team will call to coordinate size and design availability</Text>
        </View>
        <View style={styles.pointRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.pointText}>Order must have apparel</Text>
        </View>
        <View style={styles.pointRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.pointText}>Minimum cart value of Rs 500</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  badgeContainer: {
    backgroundColor: Colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.Bold,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.Bold,
    color: '#000',
    flex: 1,
  },
  titleTextBlock: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Fonts.SemiBold,
    color: '#000',
  },
  carousel: {
    marginBottom: 16,
  },
  carouselContent: {
    paddingRight: 16,
  },
  imageBox: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#fff',
    marginRight: 12,
    overflow: 'hidden',
  },
  shoeImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  couponCodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 10,
    marginBottom: 16,
  },
  couponCodeText: {
    fontSize: 12,
    color: '#000',
    fontFamily: Fonts.Medium,
    lineHeight: 18,
  },
  couponCode: {
    fontSize: 12,
    color: Colors.primary,
    fontFamily: Fonts.Bold,
    lineHeight: 18,
  },
  bullet: {
    fontSize: 14,
    marginRight: 8,
    color: '#000',
    lineHeight: 18,
  },
  pointsContainer: {
    marginTop: 8,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 10,
    marginBottom: 4,
  },
  pointText: {
    fontSize: 12,
    color: '#000',
    fontFamily: Fonts.Medium,
    lineHeight: 18,
    flex: 1,
  },
});

export default FreeShoesOffer;

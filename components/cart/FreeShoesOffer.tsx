import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

const SHOE_OPTIONS = [
  { id: 'shoe-1', name: 'Shoe 1', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/Screenshot_2026-02-08_at_12.40.43_PM.png?v=1770746854' },
  { id: 'shoe-2', name: 'Shoe 2', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/Screenshot_2026-02-08_at_12.41.54_PM.png?v=1770746844' },
  { id: 'shoe-3', name: 'Shoe 3', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/Screenshot_2026-02-08_at_12.41.17_PM.png?v=1770746855' },
  { id: 'shoe-4', name: 'Shoe 4', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/Screenshot_2026-02-08_at_12.40.14_PM.png?v=1770746855' },
];

interface FreeShoesOfferProps {
  visible?: boolean;
}

const FreeShoesOffer: React.FC<FreeShoesOfferProps> = ({ visible = true }) => {
  if (!visible) return null;

  const [isChecked, setIsChecked] = React.useState(false);
  const [failedIds, setFailedIds] = React.useState<Set<string>>(new Set());

  const handleImageError = React.useCallback((id: string) => {
    setFailedIds((prev) => new Set(prev).add(id));
  }, []);

  // Prefetch shoe images so they appear faster when the offer is visible.
  React.useEffect(() => {
    SHOE_OPTIONS.forEach((s) => {
      Image.prefetch(s.imageUrl).catch(() => {});
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeText}>Introductory Offer</Text>
      </View>
      
      <View style={styles.titleRow}>
        <TouchableOpacity
          onPress={() => setIsChecked((v) => !v)}
          activeOpacity={0.7}
          style={styles.checkboxRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isChecked }}
        >
          <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
            {isChecked && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
        </TouchableOpacity>
        <View style={styles.titleTextBlock}>
          <Text style={styles.title}>Get free shoes on first apparel order</Text>
          <Text style={styles.subtitle}>For Limited Customers Only</Text>
        </View>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.carousel} 
        contentContainerStyle={styles.carouselContent}
      >
        {SHOE_OPTIONS.map((shoe) => (
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

      <View style={styles.bulletsContainer}>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>
            Offer eligible if order has apparel, minimum purchase of Rs. 500
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>Kiddo team will call you to coordinate sizes once you order</Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>Only applicable once per user</Text>
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
    marginBottom: 16,
    gap: 10,
  },
  checkboxRow: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  // Match Cart "Try & Buy" checkbox styling, using theme red
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
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
  bulletsContainer: {
    gap: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 10,
  },
  bullet: {
    fontSize: 14,
    marginRight: 8,
    color: '#000',
    lineHeight: 18,
  },
  bulletText: {
    fontSize: 12,
    color: '#000',
    fontFamily: Fonts.Medium,
    flex: 1,
    lineHeight: 18,
  },
});

export default FreeShoesOffer;

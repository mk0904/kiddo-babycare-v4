import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const SHOE_OPTIONS = [
  { id: 'shoe-1', name: 'Shoe 1', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/ChatGPT_Image_Feb_8_2026_02_19_53_AM.png?v=1770497452' },
  { id: 'shoe-2', name: 'Shoe 2', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/ChatGPT_Image_Feb_8_2026_02_19_53_AM.png?v=1770497452' },
  { id: 'shoe-3', name: 'Shoe 3', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/ChatGPT_Image_Feb_8_2026_02_19_53_AM.png?v=1770497452' },
  { id: 'shoe-4', name: 'Shoe 4', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/ChatGPT_Image_Feb_8_2026_02_19_53_AM.png?v=1770497452' },
];

interface FreeShoesOfferProps {
  visible?: boolean;
}

const FreeShoesOffer: React.FC<FreeShoesOfferProps> = ({ visible = true }) => {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeText}>Introductory Offer</Text>
      </View>
      
      <View style={styles.titleRow}>
        <Ionicons name="checkbox" size={24} color="#000" />
        <Text style={styles.title}>Get free pair of shoes from Kiddo</Text>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.carousel} 
        contentContainerStyle={styles.carouselContent}
      >
        {SHOE_OPTIONS.map((shoe) => (
          <View key={shoe.id} style={styles.imageBox}>
            <Image
              source={{ uri: shoe.imageUrl }}
              style={styles.shoeImage}
              contentFit="cover"
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              transition={200}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.bulletsContainer}>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>Offer only eligible if you have a fashion item in your cart.</Text>
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
    backgroundColor: '#E57373',
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
  title: {
    fontSize: 18,
    fontFamily: Fonts.Bold,
    color: '#000',
    flex: 1,
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

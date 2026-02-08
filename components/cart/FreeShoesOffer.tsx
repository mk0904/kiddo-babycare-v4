import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
        {[1, 2, 3, 4].map((_, index) => (
          <View key={index} style={styles.imageBox} />
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
    borderWidth: 1,
    borderColor: '#000',
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

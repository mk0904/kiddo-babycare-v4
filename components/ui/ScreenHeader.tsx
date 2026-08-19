import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ScreenHeaderProps {
  title: string;
  showSearch?: boolean;
  showBack?: boolean;
  showWishlist?: boolean;
  onBackPress?: () => void;
  onWishlistPress?: () => void;
}

export function ScreenHeader({ title, showSearch = true, showBack = false, showWishlist = false, onBackPress, onWishlistPress }: ScreenHeaderProps) {
  const router = useRouter();

  const handleSearchPress = () => {
    router.push('/search');
  };

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const handleWishlistPress = () => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onWishlistPress) {
      onWishlistPress();
    } else {
      router.push('/wishlist');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.rightSection}>
        {showSearch && (
          <TouchableOpacity
            onPress={handleSearchPress}
            style={styles.searchButton}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
        )}
        {showWishlist && (
          <TouchableOpacity
            onPress={handleWishlistPress}
            style={styles.wishlistButton}
            activeOpacity={0.7}
          >
            <Ionicons name="heart-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    fontFamily: Fonts.Medium,
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchButton: {
    padding: 4,
  },
  wishlistButton: {
    padding: 4,
  },
});

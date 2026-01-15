import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Fonts } from '@/constants/theme';

interface ScreenHeaderProps {
  title: string;
  showSearch?: boolean;
}

export function ScreenHeader({ title, showSearch = true }: ScreenHeaderProps) {
  const router = useRouter();

  const handleSearchPress = () => {
    router.push('/search');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {showSearch && (
        <TouchableOpacity
          onPress={handleSearchPress}
          style={styles.searchButton}
          activeOpacity={0.7}
        >
          <Ionicons name="search-outline" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: Fonts.Medium,
  },
  searchButton: {
    padding: 4,
  },
});

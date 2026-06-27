import { Fonts } from '@/constants/theme';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface TryAtHomePillProps {
  onPress?: () => void;
}


export function TryAtHomePill({ onPress }: TryAtHomePillProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <LinearGradient
        colors={['#ffe1a4', '#ff7c90']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pill}
      >
        <Text style={styles.label}>
          <Text style={styles.tryAtHome}>Try at home</Text>{'\n'}Instant Refund
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  pill: {
    width: 100,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 0,
    left: 10
  },
  tryAtHome: {
    fontSize: 12, // bigger
  },
  label: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: Fonts.LexendSemiBold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
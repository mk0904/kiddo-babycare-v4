import { Colors, Fonts } from '@/constants/theme';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ICONS = {
  recycle: require('@/assets/icons/recycle.png'),
  light: require('@/assets/icons/light.png'),
  heart: require('@/assets/icons/heart.png'),
} as const;

interface ProductTrustStripProps {
  refundPolicyText?: string | null;
  onKnowMorePress?: () => void;
}

export function ProductTrustStrip({ refundPolicyText, onKnowMorePress }: ProductTrustStripProps) {
  const refundText = refundPolicyText?.trim() || '7 Days\nEasy Returns';

  return (
    <View style={styles.container}>
      <View style={styles.item}>
        <Image source={ICONS.recycle} style={styles.icon} resizeMode="contain" />
        <View style={styles.textColumn}>
          <Text style={styles.primaryText} numberOfLines={2}>
            {refundText}
          </Text>
          {onKnowMorePress ? (
            <TouchableOpacity onPress={onKnowMorePress} activeOpacity={0.7} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Text style={styles.knowMoreText}>Know More</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.item}>
        <Image source={ICONS.light} style={styles.icon} resizeMode="contain" />
        <Text style={styles.primaryText}>Delivered{'\n'}in Minutes</Text>
      </View>

      <View style={styles.item}>
        <Image source={ICONS.heart} style={styles.icon} resizeMode="contain" />
        <Text style={styles.primaryText}>Loved by{'\n'}Parents</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    gap: 6,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  icon: {
    width: 28,
    height: 28,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  primaryText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 14,
    fontFamily: Fonts.LexendSemiBold,
    color: Colors.text,
  },
  knowMoreText: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 12,
    fontFamily: Fonts.LexendSemiBold,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});

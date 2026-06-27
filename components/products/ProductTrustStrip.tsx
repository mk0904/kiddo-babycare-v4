import { Colors, Fonts } from '@/constants/theme';
import { Image, StyleSheet, Text, View } from 'react-native';

const ICONS = {
  recycle: require('@/assets/icons/recycle1.png'),
  light: require('@/assets/icons/lightning.png'),
  heart: require('@/assets/icons/love.png'),
} as const;

interface ProductTrustStripProps {
  refundPolicyText?: string | null;
  onKnowMorePress?: () => void;
}

export function ProductTrustStrip({ refundPolicyText, onKnowMorePress }: ProductTrustStripProps) {
  const refundText = refundPolicyText?.trim() || '72hr\nReplacement';

  return (
    <View style={styles.container}>
      <View style={styles.item}>
        <View style={[styles.iconWrapper, { backgroundColor: '#FEFBE8' }]}>
          <Image source={ICONS.recycle} style={styles.icon} resizeMode="contain" />
        </View>
        <Text style={styles.primaryText} numberOfLines={2}>
          {refundText}
        </Text>
      </View>

      <View style={styles.item}>
        <View style={[styles.iconWrapper, { backgroundColor: '#FEF6EE' }]}>
          <Image source={ICONS.light} style={styles.icon} resizeMode="contain" />
        </View>
        <Text style={styles.primaryText}>Delivered{'\n'}in Minutes</Text>
      </View>

      <View style={styles.item}>
        <View style={[styles.iconWrapper, { backgroundColor: '#FEEFEF' }]}>
          <Image source={ICONS.heart} style={styles.icon} resizeMode="contain" />
        </View>
        <Text style={styles.primaryText}>Loved by{'\n'}Parents</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    gap: 6,
    backgroundColor: "white",
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  icon: {
    width: 17,
    height: 20.8,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  primaryText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.LexendSemiBold,
    color: Colors.text,
    textAlign: 'center',
  },
  knowMoreText: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 12,
    fontFamily: Fonts.LexendSemiBold,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  }
});

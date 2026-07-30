import { Colors, Fonts } from '@/constants/theme';
import { useRef, useState } from 'react';
import {
    Animated,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

const ICONS = {
  replacement72: require('@/assets/icons/72.png'),
  light2: require('@/assets/icons/light2.png'),
  headphone1: require('@/assets/icons/headphone1.png'),
  tryandbuy: require('@/assets/icons/tryandbuy.png'),
} as const;

interface ProductTrustStripProps {
  refundPolicyText?: string | null;
  onKnowMorePress?: () => void;
  isFashion?: boolean;
  tryAndBuyEnabled?: boolean;
}

interface TrustItem {
  icon: any;
  label: string;
  accentColor: string;
  bgColor: string;
  title: string;
  description: string;
  isTryBuy?: boolean;
}

const TaperedBackground = ({ color }: { color: string }) => (
  <>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: color, borderRadius: 12 }]} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'white', borderRadius: 12, bottom: 3, top: -3 }]} />
  </>
);

export function ProductTrustStrip({ refundPolicyText, onKnowMorePress, isFashion, tryAndBuyEnabled }: ProductTrustStripProps) {
  const [activeItem, setActiveItem] = useState<TrustItem | null>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const items: TrustItem[] = tryAndBuyEnabled
    ? [
      {
        icon: ICONS.tryandbuy,
        label: 'Try Upto\n10 Items',
        accentColor: '#EAAA08',
        bgColor: '#FEFBE8',
        title: 'Try Up to 10 Items',
        description: 'Order multiple sizes and styles. Try them at home and only pay for what you keep.',
        isTryBuy: true,
      },
      {
        icon: ICONS.replacement72,
        label: refundPolicyText?.trim() || '72hr\nReplacement',
        accentColor: '#F38744',
        bgColor: '#FEF6EE',
        title: '72 Hours Replacement',
        description: 'Eligible if you recieve a damaged, defected, expired, incorrect or missing item.',
      },
      {
        icon: ICONS.headphone1,
        label: '24x7\nSupport',
        accentColor: '#F15E5E',
        bgColor: '#FEEFEF',
        title: '24x7 Support',
        description: 'Get 24/7 customer support for quick help with your orders',
      },
    ]
    : [
      {
        icon: ICONS.replacement72,
        label: refundPolicyText?.trim() || '72hr\nReplacement',
        accentColor: '#F38744',
        bgColor: '#FEF6EE',
        title: '72 Hours Replacement',
        description: 'Eligible if you recieve a damaged, defected, expired, incorrect or missing item.',
      },
      {
        icon: ICONS.light2,
        label: 'Delivered\nin Minutes',
        accentColor: '#EAAA08',
        bgColor: '#FEFBE8',
        title: 'Delivered in Minutes',
        description: 'Get your order delivered to your doorstep in just minutes',
      },
      {
        icon: ICONS.headphone1,
        label: '24x7\nSupport',
        accentColor: '#F15E5E',
        bgColor: '#FEEFEF',
        title: '24x7 Support',
        description: 'Get 24/7 customer support for quick help with your orders',
      },
    ];

  const openModal = (item: TrustItem) => {
    setActiveItem(item);
    slideAnim.setValue(300);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }),
    ]).start(() => setActiveItem(null));
  };

  return (
    <>
      <View style={styles.container}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.item}
            onPress={() => openModal(item)}
            activeOpacity={0.85}
          >
            <TaperedBackground color={item.accentColor} />
            <View style={[styles.iconWrapper, { backgroundColor: item.bgColor }]}>
              <Image source={item.icon} style={styles.icon} resizeMode="contain" />
            </View>
            <Text style={styles.primaryText} numberOfLines={2}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal transparent visible={!!activeItem} onRequestClose={closeModal} animationType="none">
        <TouchableWithoutFeedback onPress={closeModal}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {activeItem && (
          <Animated.View
            style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}
          >
            {/* Header pill */}
            <View style={styles.sheetPill} />

            {/* Icon + Title row */}
            <View style={[styles.sheetHeader, { backgroundColor: activeItem.bgColor }]}>
              <View style={[styles.sheetIconWrapper, { backgroundColor: activeItem.bgColor }]}>
                <Image source={activeItem.icon} style={styles.sheetIcon} resizeMode="contain" />
              </View>
              <Text style={[styles.sheetTitle, { color: activeItem.accentColor }]}>
                {activeItem.title}
              </Text>
            </View>

            {/* Body */}
            {activeItem.isTryBuy ? (
              <View style={styles.sheetBody}>
                {/* Bold bullets */}
                {[
                  'Order try and buy eligible products',
                  'Try at home for 30 mins and pay on delivery',
                  'Keep what you love, return the rest',
                ].map((point, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={[styles.bulletDot, { color: '#717680' }]}>•</Text>
                    <Text style={styles.bulletText}>{point}</Text>
                  </View>
                ))}

                {/* Important note section */}
                <View style={styles.importantNoteSeparator} />
                <Text style={styles.importantNoteLabel}>Important note:</Text>

                {[
                  'Items kept after try & buy are not eligible for return or exchange',
                  'Please ensure that product & tags are in original condition and the outer packaging is kept intact on returning the product',
                ].map((note, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={[styles.bulletDot, { color: '#717680' }]}>•</Text>
                    <Text style={styles.noteBulletText}>{note}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.sheetBody}>
                <Text style={styles.sheetDescription}>{activeItem.description}</Text>
              </View>
            )}
          </Animated.View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    gap: 12,
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  icon: {
    width: 26,
    height: 26,
  },
  primaryText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.LexendSemiBold,
    color: Colors.text,
    textAlign: 'center',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    height: 62,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sheetIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIcon: {
    width: 38,
    height: 38,
  },
  sheetTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontFamily: Fonts.FredokaSemiBold,
    flexShrink: 1,
  },
  sheetBody: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
  },
  sheetDescription: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Fonts.LexendMedium,
    fontWeight: '500',
    color: Colors.text,
  },

  // Try & Buy specific
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  bulletDot: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: Fonts.LexendBold,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Fonts.LexendMedium,
    fontWeight: '500',
    color: Colors.text,
  },
  importantNoteSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 14,
  },
  importantNoteLabel: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Fonts.LexendMedium,
    fontWeight: '500',
    color: '#717680',
    marginBottom: 8,
  },
  noteBulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Fonts.LexendMedium,
    fontWeight: '500',
    color: '#717680',
  },
});

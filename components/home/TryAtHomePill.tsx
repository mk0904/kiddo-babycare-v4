import { Fonts } from '@/constants/theme';
import { configService } from '@/services/configService';
import * as Haptics from 'expo-haptics';
import { Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface TryAtHomePillProps {
  onPress?: () => void;
}

export function TryAtHomePill({ onPress }: TryAtHomePillProps) {
  const tryAtHomePillConfig = (configService.getConfig() as any)?.header?.styles?.tryAtHomePill;
  const config = tryAtHomePillConfig || {};
  const isImageMode = config.type === 'image' && config.imageUrl;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      {isImageMode ? (
        <Image
          source={{ uri: config.imageUrl }}
          style={[
            styles.pill,
            {
              width: config.width ?? 100,
              height: config.height ?? 46,
              borderRadius: config.borderRadius ?? 12,
              marginLeft: config.container?.marginLeft ?? 0,
              left: config.container?.left ?? 10,
            },
          ]}
          resizeMode="contain"
        />
      ) : (
        <LinearGradient
          colors={config.gradientColors || ['#ffe1a4', '#ff7c90']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.pill,
            {
              width: config.width ?? 100,
              height: config.height ?? 46,
              borderRadius: config.borderRadius ?? 12,
              marginLeft: config.container?.marginLeft ?? 0,
              left: config.container?.left ?? 10,
            },
          ]}
        >
          <Text
            style={[
              styles.label,
              {
                fontSize: config.text?.labelFontSize ?? 10,
                lineHeight: config.text?.labelLineHeight ?? 12,
                fontFamily: config.text?.fontFamily === 'lexend' ? Fonts.LexendSemiBold : Fonts.LexendSemiBold,
                color: config.text?.color ?? '#FFFFFF',
                textAlign: (config.text?.textAlign ?? 'center') as 'center' | 'auto' | 'left' | 'right' | 'justify',
              },
            ]}
          >
            <Text
              style={[
                styles.tryAtHome,
                { fontSize: config.text?.tryAtHomeFontSize ?? 12 },
              ]}
            >
              {config.text?.tryAtHome ?? 'Try at home'}
            </Text>
            {'\n'}
            {config.text?.instantRefund ?? 'Instant Refund'}
          </Text>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  pill: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tryAtHome: {},
  label: {},
});
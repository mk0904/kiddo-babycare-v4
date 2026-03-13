import { Fonts } from '@/constants/theme';
import { NoInternetBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

interface NoInternetProps extends BaseContentBlockProps {
  block: NoInternetBlock;
  onPress?: (link?: string, item?: any) => void;
}

export function NoInternet({ block, onPress }: NoInternetProps) {
  const [buttonText, setButtonText] = useState(
    block.data?.buttonText || 'REFRESH'
  );
  const [loading, setLoading] = useState(false);

  const {
    data = {},
    styles: blockStyles,
  } = block;

  const handlePress = async () => {
    setLoading(true);
    setButtonText(data.loadingText || 'Refreshing...');

    try {
      // Refresh network status using NetInfo
      await NetInfo.fetch();
      
      // Wait a bit to ensure state updates
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reset button text regardless of result
      setButtonText(data.buttonText || 'REFRESH');
    } catch (error) {
      console.error('Error checking network:', error);
      setButtonText(data.buttonText || 'REFRESH');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseContentBlock block={block}>
      <View style={[styles.container, blockStyles?.root]}>
        {data.iconId && (
          <Ionicons
            name="cloud-offline-outline"
            size={42}
            color={blockStyles?.icon?.color || '#000'}
            style={[styles.icon, blockStyles?.icon]}
          />
        )}
        {data.heading && (
          <Text style={[styles.heading, processFontStyle(blockStyles?.heading, Fonts.Black)]}>
            {data.heading}
          </Text>
        )}
        {data.text && (
          <Text style={[styles.text, processFontStyle(blockStyles?.text)]}>{data.text}</Text>
        )}
        <Button
          onPress={handlePress}
          disabled={loading}
          style={[styles.button, blockStyles?.button]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.buttonText, blockStyles?.buttonText]}>
              {buttonText}
            </Text>
          )}
        </Button>
      </View>
    </BaseContentBlock>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    margin: 16,
  },
  icon: {
    marginBottom: 16,
  },
  heading: {
    fontSize: 18,
    fontFamily: Fonts.Black,
    color: '#000',
    marginTop: 16,
    marginBottom: 4,
    textAlign: 'center',
  },
  text: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
    minWidth: 120,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.SemiBold,
  },
});


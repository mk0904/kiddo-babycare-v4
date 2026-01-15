import { BlockRenderer } from '@/components/content/BlockRenderer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { configService } from '@/services/configService';
import { ContentBlock } from '@/types/content';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CategoryScreen() {
  const [configLoading, setConfigLoading] = useState(true);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  // Load category screen blocks
  useEffect(() => {
    const loadConfig = async () => {
      setConfigLoading(true);
      try {
        await configService.loadConfig();
        const categoryBlocks = configService.getCategoryScreenBlocks();
        setBlocks(categoryBlocks);
      } catch (error) {
        console.error('[CategoryScreen] Error loading config:', error);
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleBlockPress = (block: ContentBlock, link?: string, item?: any) => {
    // Handle block press if needed
    if (link) {
      // Handle navigation based on link type
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Category" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BlockRenderer blocks={blocks} onBlockPress={handleBlockPress} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
});

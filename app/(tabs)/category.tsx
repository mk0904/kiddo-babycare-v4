import { BlockRenderer } from '@/components/content/BlockRenderer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { configService } from '@/services/configService';
import { ContentBlock } from '@/types/content';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DEFAULT_HEADER = { title: 'Category', showSearch: true, showWishlist: true };

export default function CategoryScreen() {
  const router = useRouter();
  const [configLoading, setConfigLoading] = useState(true);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  const screenConfig = useMemo(() => configService.getCategoryScreenConfig(), [configLoading]);
  const headerConfig = useMemo(() => ({ ...DEFAULT_HEADER, ...screenConfig?.header }), [screenConfig]);
  const screenStyles = useMemo(() => screenConfig?.styles?.container as ViewStyle | undefined, [screenConfig]);

  // Load category screen blocks from config
  useEffect(() => {
    const loadConfig = async () => {
      setConfigLoading(true);
      try {
        await configService.loadConfig();
        setBlocks(configService.getCategoryScreenBlocks());
      } catch (error) {
        console.error('[CategoryScreen] Error loading config:', error);
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleBlockPress = useCallback((block: ContentBlock, link?: string, item?: any) => {
    if (!link && !item?.collectionId && !item?.id) {
      return;
    }

    // Check if this is a collection click
    const isCollection = (typeof link === 'string' && link.includes('/collections/')) || item?.collectionId || (item?.id && item?.id.includes('Collection'));
    
    if (isCollection) {
      let collectionId = '';
      let title = '';

      // Priority: item.collectionId > extract from link > item.id
      if (item?.collectionId) {
        collectionId = item.collectionId;
        title = item.collectionName || item.name || item.title || item.label || '';
      } else if (typeof link === 'string' && link.includes('/collections/')) {
        const parts = link.split('/collections/');
        collectionId = parts[parts.length - 1]?.split('?')[0] || ''; // Remove query params if any
        title = item?.collectionName || item?.name || item?.title || item?.label || '';
      } else if (item?.id) {
        collectionId = item.id;
        title = item.name || item.title || item.label || '';
      }

      if (collectionId) {
        // Ensure collectionId is properly formatted (handle gid:// format)
        // Match home page behavior: keep gid:// format if present, otherwise use as-is
        const formattedId = collectionId.startsWith('gid://') 
          ? collectionId 
          : collectionId;
        
        router.push({
          pathname: '/infinity/[collectionId]',
          params: { collectionId: formattedId, title: title || '' }
        } as any);
        return;
      }
    }

    // Handle other navigation
    if (link && typeof link === 'string') {
      router.push(link as any);
    }
  }, [router]);

  return (
    <SafeAreaView style={[styles.container, screenStyles]} edges={['top']}>
      <ScreenHeader
        title={headerConfig.title ?? DEFAULT_HEADER.title}
        showSearch={headerConfig.showSearch ?? DEFAULT_HEADER.showSearch}
        showWishlist={headerConfig.showWishlist ?? DEFAULT_HEADER.showWishlist}
        showBack
        onBackPress={() => router.replace('/(tabs)')}
      />
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

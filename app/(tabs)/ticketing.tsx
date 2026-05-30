import { BlockRenderer } from '@/components/content/BlockRenderer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { configService } from '@/services/configService';
import { ContentBlock } from '@/types/content';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DEFAULT_HEADER = { title: 'Ticketing', showSearch: false, showWishlist: false };

export default function TicketingScreen() {
  const { reset: resetTabBar } = useTabBarVisibility();
  const router = useRouter();
  const [configLoading, setConfigLoading] = useState(true);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  const screenConfig = useMemo(() => configService.getTicketingScreenConfig(), [configLoading]);
  const headerConfig = useMemo(() => ({ ...DEFAULT_HEADER, ...screenConfig?.header }), [screenConfig]);
  const screenStyles = useMemo(() => screenConfig?.styles?.container as ViewStyle | undefined, [screenConfig]);

  useEffect(() => {
    resetTabBar();
    return () => resetTabBar();
  }, [resetTabBar]);

  useEffect(() => {
    const loadConfig = async () => {
      setConfigLoading(true);
      try {
        await configService.loadConfig();
        setBlocks(configService.getTicketingScreenBlocks());
      } catch (error) {
        console.error('[TicketingScreen] Error loading config:', error);
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleBlockPress = useCallback(
    (block: ContentBlock, link?: string, item?: any) => {
      try {
        const { trackTappedInTicketing } = require('@/utils/mixpanelHelpers');
        const ticketName = item?.title || item?.name || item?.label || block.title || 'unknown_ticket';
        trackTappedInTicketing(ticketName);
      } catch (e) {
        console.warn('Analytics tracking error:', e);
      }

      if (!link && !item?.collectionId && !item?.id) return;

      const isCollection =
        (typeof link === 'string' && link.includes('/collections/')) ||
        item?.collectionId ||
        (item?.id && String(item?.id).includes('Collection'));

      if (isCollection) {
        let collectionId = '';
        let title = '';

        if (item?.collectionId) {
          collectionId = item.collectionId;
          title = item.collectionName || item.name || item.title || item.label || '';
        } else if (typeof link === 'string' && link.includes('/collections/')) {
          const parts = link.split('/collections/');
          collectionId = parts[parts.length - 1]?.split('?')[0] || '';
          title = item?.collectionName || item?.name || item?.title || item?.label || '';
        } else if (item?.id) {
          collectionId = item.id;
          title = item.name || item.title || item.label || '';
        }

        if (collectionId) {
          router.push({
            pathname: '/infinity/[collectionId]',
            params: {
              collectionId: collectionId.startsWith('gid://') ? collectionId : collectionId,
              title: title || '',
              hideFilters: 'true',
              fromTicketing: 'true',
            },
          } as any);
          return;
        }
      }

      if (link && typeof link === 'string') {
        router.push(link as any);
      }
    },
    [router]
  );

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
        <BlockRenderer blocks={blocks} onBlockPress={handleBlockPress} blockSpacing={0} />
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
    paddingBottom: 48,
  },
});

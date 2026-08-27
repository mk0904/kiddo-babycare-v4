import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Fonts } from '@/constants/theme';
import { shopifyApi } from '@/services/shopifyApi';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const PAGE_ID = '162592751905';

export default function PrivacyPolicyScreen() {
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        setLoading(true);
        const pageData = await shopifyApi.getPageById(PAGE_ID);
        setPage(pageData);
        setError(null);
      } catch (err) {
        console.error('Error fetching privacy policy page:', err);
        setError('Failed to load page content. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, []);

  const generateHtml = (body: string) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              font-size: 16px;
              line-height: 1.6;
              color: #181D27;
              padding: 16px;
              margin: 0;
              background-color: #FFFFFF;
            }
            h1 { font-size: 24px; font-weight: bold; margin: 24px 0 12px 0; }
            h2 { font-size: 20px; font-weight: bold; margin: 20px 0 10px 0; }
            h3 { font-size: 18px; font-weight: bold; margin: 16px 0 8px 0; }
            p { margin: 0 0 16px 0; }
            ul, ol { margin: 0 0 16px 20px; }
            li { margin: 0 0 8px 0; }
            strong, b { font-weight: bold; }
            a { color: #9333EA; text-decoration: underline; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          ${body}
        </body>
      </html>
    `;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={page?.title || 'Privacy Policy'}
        showBack={true}
        showSearch={false}
        onBackPress={() => {
          // @ts-ignore
          require('expo-router').router.back();
        }}
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <WebView
          source={{ html: generateHtml(page?.body || '') }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
    fontFamily: Fonts.Regular,
    textAlign: 'center',
  },
});

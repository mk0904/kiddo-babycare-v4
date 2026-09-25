import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Image,
  ImageBackground,
  ScrollView,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CarouselItem {
  imageUrl: string | number;
  title?: string;
  subtitle?: string;
  link?: string | any; // Can be string or object (e.g., { type: "collection", collection: { id: "..." } })
  id?: string;
}

interface CarouselProps {
  data: CarouselItem[];
  config?: {
    autoPlay?: boolean;
    autoPlayInterval?: number;
    loop?: boolean;
    height?: number;
    borderRadius?: number;
    resizeMode?: 'cover' | 'contain';
    showTextOverlay?: boolean;
    showPagination?: boolean;
  };
  styles?: {
    container?: any;
    imageContainer?: any;
    img?: any;
  };
  onItemPress?: (link?: string | any) => void;
  onIndexChange?: (index: number) => void;
}

export function Carousel({
  data,
  config = {},
  styles: customStyles = {},
  onItemPress,
  onIndexChange,
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);

  const {
    autoPlay = false,
    autoPlayInterval = 3000,
    loop = true,
    height = 0.5625,
    borderRadius = 0,
    resizeMode = 'cover',
    showTextOverlay = true,
  } = config;

  const paddingHorizontal =
    customStyles.imageContainer?.paddingHorizontal ||
    customStyles.container?.paddingHorizontal ||
    0;
  const marginHorizontal = customStyles.container?.marginHorizontal || 0;

  const scrollViewWidth = SCREEN_WIDTH - marginHorizontal * 2;
  const imageWidth = scrollViewWidth - paddingHorizontal * 2;
  const imageHeight = imageWidth * height;

  const normalizedData = useMemo(() => {
    return (data || [])
      .map((item, idx) => {
        if (typeof item === 'string' || typeof item === 'number') {
          return { imageUrl: item, link: null, id: `carousel-item-${idx}` };
        }
        const imageUrl = item.imageUrl;
        if (!imageUrl) {
          return null;
        }
        return {
          imageUrl,
          link: item.link || null,
          id: item.id || `carousel-item-${idx}`,
          title: item.title || null,
          subtitle: item.subtitle || null,
        };
      })
      .filter(Boolean) as CarouselItem[];
  }, [data]);

  const infiniteData = useMemo(() => {
    return normalizedData.length > 1
      ? [
          normalizedData[normalizedData.length - 1],
          ...normalizedData,
          normalizedData[0],
        ]
      : normalizedData;
  }, [normalizedData]);

  const startIndex = normalizedData.length > 1 ? 1 : 0;

  useEffect(() => {
    if (normalizedData.length > 1 && scrollViewRef.current) {
      const initialPosition = startIndex * scrollViewWidth;
      scrollViewRef.current.scrollTo({ x: initialPosition, animated: false });
      if (onIndexChange) {
        onIndexChange(0);
      }
    } else if (normalizedData.length === 1 && onIndexChange) {
      onIndexChange(0);
    }
  }, [normalizedData.length, scrollViewWidth, startIndex, onIndexChange]);

  useEffect(() => {
    if (autoPlay && normalizedData.length > 1 && !isScrollingRef.current) {
      intervalRef.current = setInterval(() => {
        const nextIndex =
          currentIndex + 1 >= normalizedData.length ? 0 : currentIndex + 1;
        const scrollPosition = (nextIndex + 1) * scrollViewWidth;
        scrollViewRef.current?.scrollTo({
          x: scrollPosition,
          animated: true,
        });
      }, autoPlayInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    autoPlay,
    autoPlayInterval,
    normalizedData.length,
    scrollViewWidth,
    currentIndex,
  ]);

  const handleScroll = (event: any) => {
    if (!scrollViewRef.current) return;

    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / scrollViewWidth);

    if (normalizedData.length > 1) {
      if (index === 0) {
        setTimeout(() => {
          const jumpPosition = normalizedData.length * scrollViewWidth;
          scrollViewRef.current?.scrollTo({
            x: jumpPosition,
            animated: false,
          });
          const lastIndex = normalizedData.length - 1;
          setCurrentIndex(lastIndex);
          if (onIndexChange) {
            onIndexChange(lastIndex);
          }
        }, 50);
      } else if (index === infiniteData.length - 1) {
        setTimeout(() => {
          const jumpPosition = scrollViewWidth;
          scrollViewRef.current?.scrollTo({
            x: jumpPosition,
            animated: false,
          });
          setCurrentIndex(0);
          if (onIndexChange) {
            onIndexChange(0);
          }
        }, 50);
      } else {
        const adjustedIndex = index - 1;
        setCurrentIndex(adjustedIndex);
        if (onIndexChange) {
          onIndexChange(adjustedIndex);
        }
      }
    } else {
      setCurrentIndex(index);
      if (onIndexChange) {
        onIndexChange(index);
      }
    }
  };

  const handleScrollBeginDrag = () => {
    isScrollingRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const handleScrollEndDrag = () => {
    isScrollingRef.current = false;
  };

  // Extract backgroundImage and paddingHorizontal from container styles
  // paddingHorizontal should not be applied to container (it's for imageContainer)
  const { 
    backgroundImage,
    paddingHorizontal: containerPaddingHorizontal, // Extract this, don't apply to container
    ...containerStylesWithoutBg 
  } = customStyles.container || {};
  
  const containerStyle = [
    defaultStyles.container,
    containerStylesWithoutBg,
  ];

  const scrollViewStyle = [
    defaultStyles.scrollView,
    {
      width: scrollViewWidth,
      height: imageHeight,
    },
  ];

  const imageContainerStyle = [
    defaultStyles.imageContainer,
    customStyles.imageContainer,
    {
      width: scrollViewWidth,
      height: imageHeight,
      paddingHorizontal: Platform.OS === 'android' ? 0 : paddingHorizontal,
      borderRadius: borderRadius || customStyles.imageContainer?.borderRadius || 0,
    },
  ];

  const imageStyle = [
    defaultStyles.image,
    customStyles.img,
    {
      height: imageHeight,
      width: imageWidth,
      borderRadius: borderRadius || customStyles.img?.borderRadius || 0,
    },
  ];

  const ContainerWrapper = backgroundImage ? ImageBackground : View;
  const containerWrapperProps = backgroundImage 
    ? { 
        source: { uri: backgroundImage },
        style: containerStyle,
        imageStyle: customStyles.container?.backgroundImageStyle || {},
        resizeMode: customStyles.container?.backgroundResizeMode || 'cover',
      }
    : { style: containerStyle };

  return (
    <ContainerWrapper {...containerWrapperProps}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={[{ backgroundColor: 'transparent' }, scrollViewStyle]}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={false}
        contentContainerStyle={{
          paddingHorizontal: Platform.OS === 'android' ? paddingHorizontal : 0,
          alignItems: 'center',
          paddingLeft: Platform.OS === 'android' ? paddingHorizontal : 0,
          paddingRight: Platform.OS === 'android' ? paddingHorizontal : 0,
        }}
      >
        {infiniteData.map((item, index) => {
          const imageUrl = item.imageUrl;
          const link = item.link;
          const itemId = item.id || `carousel-${index}`;
          const hasLink = link && onItemPress;

          if (!imageUrl) {
            return null;
          }

          const hasTextOverlay =
            showTextOverlay && (item.title || item.subtitle);

          const imageSource =
            typeof imageUrl === 'number'
              ? imageUrl
              : { uri: imageUrl as string };

          const imageContent = (
            <View style={{ width: '100%', height: '100%', position: 'relative' }}>
              <Image
                source={imageSource}
                style={imageStyle}
                resizeMode={resizeMode}
              />
              {hasTextOverlay && (
                <View style={defaultStyles.textOverlay}>
                  {item.title && (
                    <Text style={defaultStyles.overlayTitle}>{item.title}</Text>
                  )}
                  {item.subtitle && (
                    <Text style={defaultStyles.overlaySubtitle}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );

          return (
            <View key={`${itemId}-${index}`} style={imageContainerStyle}>
              {hasLink ? (
                <TouchableOpacity
                  onPress={() => onItemPress(link)}
                  activeOpacity={0.8}
                  style={{ width: '100%', height: '100%' }}
                >
                  {imageContent}
                </TouchableOpacity>
              ) : (
                imageContent
              )}
            </View>
          );
        })}
      </ScrollView>
      {config.showPagination && (
        <View style={defaultStyles.paginationContainer}>
          {data.map((_, i) => (
            <View
              key={i}
              style={[
                defaultStyles.paginationDot,
                i === currentIndex && defaultStyles.paginationDotActive,
              ]}
            />
          ))}
        </View>
      )}
    </ContainerWrapper>
  );
}

const defaultStyles = StyleSheet.create({
  container: {
    width: '100%',
    // Transparent so block/config container background shows; avoids white strips during swipe
    backgroundColor: 'transparent',
  },
  scrollView: {
    width: '100%',
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {},
  textOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  overlayTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlaySubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.95,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: -4,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    width: 12,
    backgroundColor: '#000000',
  },
});


import { Fonts } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { VideoBannerBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import {
    resolveFixedImageHeight,
    resolveImageHeightFromAspect,
    resolveRowWidths,
} from '@/utils/gridCellSizing';
import { Image } from 'expo-image';
import { ResizeMode, Video } from 'expo-av';
import React, { useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image as RNImage,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

interface VideoBannerProps extends Omit<BaseContentBlockProps, 'onPress'> {
    block: VideoBannerBlock;
    onPress?: (link?: string, item?: any) => void;
}

type OverlayCollection = {
    id: string;
    name?: string;
    imageUrl?: string;
    aspectRatio?: number;
    widthFraction?: number;
};

function VideoBannerOverlayGrid({
    overlayGrid,
    bannerWidth,
    onPress,
}: {
    overlayGrid: NonNullable<VideoBannerBlock['overlayGrid']>;
    bannerWidth: number;
    onPress?: (link?: string, item?: any) => void;
}) {
    const containerStyles = overlayGrid.styles?.container ?? {};
    const paddingH =
        containerStyles.paddingHorizontal != null
            ? Number(containerStyles.paddingHorizontal)
            : 16;
    const paddingBottom =
        containerStyles.paddingBottom != null
            ? Number(containerStyles.paddingBottom)
            : 12;

    const gridConfig = overlayGrid.gridConfig ?? {};
    const colGap = gridConfig.colGap ?? gridConfig.gap ?? 12;
    const numColumns = gridConfig.numColumns ?? 2;
    const limit = gridConfig.limit ?? 0;
    const aspectRatio = gridConfig.aspectRatio ?? 3.2;
    const borderRadius = gridConfig.borderRadius ?? 16;
    const resizeMode = (gridConfig.resizeMode || gridConfig.imageResizeMode || 'cover') as
        | 'cover'
        | 'contain'
        | 'stretch';

    const textDisplay = overlayGrid.styles?.text?.display;
    const shouldHideLabels = textDisplay === 'none' || textDisplay === 'hidden';
    const showLabels = !shouldHideLabels && gridConfig.showLabels !== false;
    const labelSpace = showLabels ? 32 : 0;
    const fixedImageHeight = resolveFixedImageHeight(
        gridConfig.itemHeight,
        labelSpace,
        showLabels
    );

    const items = useMemo((): OverlayCollection[] => {
        const raw = overlayGrid.collectionIds ?? [];
        const normalized = raw.map((entry) =>
            typeof entry === 'string' ? { id: entry } : entry
        );
        return limit > 0 ? normalized.slice(0, limit) : normalized;
    }, [overlayGrid.collectionIds, limit]);

    const availableWidth = bannerWidth - paddingH * 2;
    const scrollable = gridConfig.scrollable === true;
    const fixedItemWidth =
        typeof gridConfig.itemWidth === 'number' && gridConfig.itemWidth > 0
            ? gridConfig.itemWidth
            : null;

    const getCellWidth = (item: OverlayCollection) => {
        if (fixedItemWidth != null) return fixedItemWidth;
        if (typeof item.widthFraction === 'number' && item.widthFraction > 0) {
            return availableWidth * item.widthFraction;
        }
        return availableWidth / Math.max(numColumns, 2);
    };

    const cellWidths = useMemo(
        () => items.map((item) => getCellWidth(item)),
        [items, availableWidth, fixedItemWidth, numColumns]
    );

    const rowWidths = useMemo(
        () => (scrollable ? cellWidths : resolveRowWidths(items, availableWidth, colGap)),
        [scrollable, cellWidths, items, availableWidth, colGap]
    );

    const getImageHeight = (item: OverlayCollection, cellWidth: number) => {
        if (fixedImageHeight != null) {
            return fixedImageHeight;
        }
        return resolveImageHeightFromAspect(
            cellWidth,
            item.aspectRatio,
            aspectRatio,
            labelSpace,
            showLabels
        );
    };

    const { fontWeight: _fw, fontFamily: _ff, ...textStyleRest } = overlayGrid.styles?.text || {};
    const labelStyle = {
        color: '#FFFFFF',
        textAlign: 'center' as const,
        fontSize: 13,
        marginTop: 8,
        ...processFontStyle(overlayGrid.styles?.text, Fonts.Bold),
        ...textStyleRest,
    };

    if (items.length === 0) return null;

    const renderCell = (item: OverlayCollection, index: number) => {
        const cellWidth = rowWidths[index] ?? availableWidth / items.length;
        const imageHeight = getImageHeight(item, cellWidth);
        const isLast = index === items.length - 1;

        return (
            <TouchableOpacity
                key={`${item.id}-${index}`}
                style={[
                    { width: cellWidth },
                    scrollable && !isLast && { marginRight: colGap },
                ]}
                activeOpacity={0.85}
                onPress={() => {
                    onPress?.(`/collections/${item.id}`, {
                        ...item,
                        collectionId: item.id,
                        collectionName: item.name,
                        name: item.name,
                    });
                }}
            >
                <View
                    style={[
                        styles.overlayImageWrap,
                        {
                            width: cellWidth,
                            height: imageHeight,
                            borderRadius,
                        },
                    ]}
                >
                    {item.imageUrl ? (
                        <Image
                            source={{ uri: item.imageUrl }}
                            style={[styles.overlayImage, { borderRadius }]}
                            contentFit={
                                resizeMode === 'stretch' ? 'fill' : resizeMode
                            }
                        />
                    ) : (
                        <View
                            style={[styles.overlayPlaceholder, { borderRadius }]}
                        />
                    )}
                </View>
                {showLabels && item.name ? (
                    <Text style={labelStyle} numberOfLines={2}>
                        {item.name}
                    </Text>
                ) : null}
            </TouchableOpacity>
        );
    };

    const overlayContainerStyle = [
        styles.overlayRoot,
        { paddingBottom },
        !scrollable && { paddingHorizontal: paddingH },
        containerStyles.backgroundColor != null && {
            backgroundColor: containerStyles.backgroundColor,
        },
    ];

    if (scrollable) {
        return (
            <View style={overlayContainerStyle} pointerEvents="box-none">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    nestedScrollEnabled
                    directionalLockEnabled
                    bounces
                    style={styles.overlayScroll}
                    contentContainerStyle={[
                        styles.overlayScrollContent,
                        { paddingHorizontal: paddingH },
                    ]}
                >
                    {items.map((item, index) => renderCell(item, index))}
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={overlayContainerStyle} pointerEvents="box-none">
            <View style={[styles.overlayRow, { columnGap: colGap, rowGap: colGap }]}>
                {items.map((item, index) => renderCell(item, index))}
            </View>
        </View>
    );
}

export function VideoBanner({ block, onPress }: VideoBannerProps) {
    const video = useRef<Video>(null);
    const { width } = useDeviceDimensions();
    const [status, setStatus] = useState<any>({});
    const [isLoaded, setIsLoaded] = useState(false);

    const { data, videoConfig = {}, styles: blockStyles, overlayGrid } = block;

    const aspectRatio = videoConfig.aspectRatio ?? 16 / 9;
    const height = width / aspectRatio;

    const showOverlay =
        !!overlayGrid?.collectionIds?.length &&
        overlayGrid.collectionIds.length > 0;

    const handleVideoPress = () => {
        if (data.link) {
            onPress?.(data.link);
            return;
        }
        if (status.isPlaying) {
            video.current?.pauseAsync();
        } else {
            video.current?.playAsync();
        }
    };

    return (
        <BaseContentBlock block={block}>
            <View style={[styles.container, { height }, blockStyles?.container]}>
                <TouchableOpacity
                    activeOpacity={data.link ? 0.9 : 1}
                    onPress={handleVideoPress}
                    style={StyleSheet.absoluteFill}
                >
                    {!isLoaded && data.posterUrl && (
                        <RNImage
                            source={{ uri: data.posterUrl }}
                            style={[StyleSheet.absoluteFill, styles.poster]}
                            resizeMode="cover"
                        />
                    )}

                    <Video
                        ref={video}
                        style={[StyleSheet.absoluteFill, styles.video, blockStyles?.video]}
                        source={{ uri: data.videoUrl }}
                        useNativeControls={false}
                        resizeMode={ResizeMode.COVER}
                        isLooping={videoConfig.loop ?? true}
                        isMuted={videoConfig.muted ?? true}
                        shouldPlay={videoConfig.autoPlay ?? true}
                        onPlaybackStatusUpdate={(playbackStatus) => {
                            setStatus(playbackStatus);
                            if (playbackStatus.isLoaded) setIsLoaded(true);
                        }}
                        posterSource={data.posterUrl ? { uri: data.posterUrl } : undefined}
                        posterStyle={{ resizeMode: 'cover' }}
                    />

                    {!isLoaded && (
                        <View style={styles.loader}>
                            <ActivityIndicator color="#FFF" />
                        </View>
                    )}
                </TouchableOpacity>

                {showOverlay && overlayGrid ? (
                    <VideoBannerOverlayGrid
                        overlayGrid={overlayGrid}
                        bannerWidth={width}
                        onPress={onPress}
                    />
                ) : null}
            </View>
        </BaseContentBlock>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    poster: {
        zIndex: 1,
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    overlayRoot: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
    },
    overlayScroll: {
        flexGrow: 0,
    },
    overlayScrollContent: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    overlayRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
    },
    overlayImageWrap: {
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    overlayImage: {
        width: '100%',
        height: '100%',
    },
    overlayPlaceholder: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
});

import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';
import { VideoBannerBlock } from '@/types/content';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { Image } from 'react-native';

interface VideoBannerProps extends Omit<BaseContentBlockProps, 'onPress'> {
    block: VideoBannerBlock;
    onPress?: (link?: string, item?: any) => void;
}

export function VideoBanner({ block, onPress }: VideoBannerProps) {
    const video = useRef<Video>(null);
    const { width } = useDeviceDimensions();
    const [status, setStatus] = useState<any>({});
    const [isLoaded, setIsLoaded] = useState(false);

    const { data, videoConfig = {}, styles: blockStyles } = block;

    // Default 16:9 if not provided
    const aspectRatio = videoConfig.aspectRatio ?? (16 / 9);
    const height = width / aspectRatio;

    const handlePress = () => {
        if (data.link) {
            onPress?.(data.link);
        } else {
            // Toggle play/pause if no link
            if (status.isPlaying) {
                video.current?.pauseAsync();
            } else {
                video.current?.playAsync();
            }
        }
    };

    return (
        <BaseContentBlock block={block}>
            <TouchableOpacity
                activeOpacity={data.link ? 0.9 : 1}
                onPress={handlePress}
                style={[styles.container, { height }, blockStyles?.container]}
            >
                {!isLoaded && data.posterUrl && (
                    <Image
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
                    onPlaybackStatusUpdate={status => {
                        setStatus(status);
                        if (status.isLoaded) setIsLoaded(true);
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
        </BaseContentBlock>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
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
    }
});

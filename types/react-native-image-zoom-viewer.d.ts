declare module 'react-native-image-zoom-viewer' {
  export interface ImageUrls {
    url: string;
    props?: any;
  }

  export interface ImageViewerProps {
    imageUrls: ImageUrls[];
    index?: number;
    onChange?: (index: number) => void;
    enableSwipeDown?: boolean;
    onSwipeDown?: () => void;
    renderIndicator?: () => React.ReactNode;
    saveToLocalByLongPress?: boolean;
    renderImage?: (props: any) => React.ReactNode;
    renderFooter?: (containerWidth: number) => React.ReactNode;
    renderHeader?: (containerWidth: number) => React.ReactNode;
    onLongPress?: (image: ImageUrls) => void;
    onClick?: (image: ImageUrls) => void;
    doubleClickInterval?: number;
    minScale?: number;
    maxScale?: number;
    swipeDownThreshold?: number;
    flipThreshold?: number;
    useNativeDriver?: boolean;
    backgroundColor?: string;
    style?: any;
    loadingRender?: () => React.ReactNode;
  }

  export default class ImageViewer extends React.Component<ImageViewerProps> {}
}

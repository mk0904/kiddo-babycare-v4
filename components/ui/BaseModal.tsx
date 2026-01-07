import React, { useState } from 'react';
import {
    View,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Dimensions,
    Text,
    ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface BaseModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    type?: 'bottomSheet' | 'centered';
    allowBackdropClose?: boolean;
    showDragHandle?: boolean;
    closeButtonPosition?: 'header' | 'above';
    containerStyle?: ViewStyle;
    contentStyle?: ViewStyle;
    animationType?: 'slide' | 'fade' | 'none';
}

const BaseModal: React.FC<BaseModalProps> = ({
    visible,
    onClose,
    title,
    children,
    type = 'bottomSheet',
    allowBackdropClose = true,
    showDragHandle = false,
    closeButtonPosition = 'header',
    containerStyle,
    contentStyle,
    animationType = 'slide',
}) => {
    if (!visible) {
        return null;
    }

    const isBottomSheet = type === 'bottomSheet';
    const [modalTop, setModalTop] = useState(0);

    const handleModalLayout = (event: any) => {
        const { y } = event.nativeEvent.layout;
        setModalTop(y);
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType={animationType}
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, isBottomSheet ? styles.bottomSheetOverlay : styles.centeredOverlay]}>
                {allowBackdropClose && (
                    <TouchableWithoutFeedback onPress={onClose}>
                        <View style={styles.backdrop} />
                    </TouchableWithoutFeedback>
                )}

                {closeButtonPosition === 'above' && (
                    <View style={[
                        styles.closeButtonAboveContainer,
                        styles.closeButtonAboveRight,
                        { top: modalTop > 0 ? modalTop - 50 : undefined } as any,
                    ]}>
                        <TouchableOpacity
                            style={styles.closeButtonAbove}
                            onPress={onClose}
                            activeOpacity={0.8}
                        >
                            <View style={styles.closeButtonAboveContainerInner}>
                                <Ionicons name="close" size={20} color={Colors.text} />
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                <View
                    style={[
                        styles.modalContainer,
                        isBottomSheet ? styles.bottomSheetContainer : styles.centeredContainer,
                        containerStyle as any
                    ]}
                    onLayout={handleModalLayout}
                >
                    {isBottomSheet && showDragHandle && (
                        <View style={styles.dragHandle} />
                    )}

                    {title && (
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>{title}</Text>
                            {closeButtonPosition === 'header' && (
                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={onClose}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.closeButtonContainer}>
                                        <Ionicons name="close" size={20} color={Colors.text} />
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <View style={[styles.content, contentStyle]}>
                        {children}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomSheetOverlay: {
        justifyContent: 'flex-end',
    },
    centeredOverlay: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContainer: {
        backgroundColor: Colors.backgroundWhite,
    },
    bottomSheetContainer: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
    },
    centeredContainer: {
        borderRadius: 20,
        width: SCREEN_WIDTH - 40,
        maxWidth: 400,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: Colors.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitle: {
        fontSize: 18,
        color: Colors.text,
        fontFamily: Fonts.Bold,
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    closeButtonContainer: {
        width: 36,
        height: 36,
        borderRadius: 14,
        backgroundColor: Colors.backgroundWhite,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    closeButtonAboveContainer: {
        position: 'absolute',
        zIndex: 1000,
    },
    closeButtonAboveRight: {
        right: 20,
    },
    closeButtonAbove: {
        zIndex: 10,
    },
    closeButtonAboveContainerInner: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: Colors.backgroundWhite,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 0, // Changed from flex: 1 to allow wrap content
    },
});

export default BaseModal;

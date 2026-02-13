import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';
import { ModalBlock } from '@/types/content';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { processFontStyle } from '@/utils/fontUtils';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BaseModalProps extends BaseContentBlockProps {
  block: ModalBlock;
  visible?: boolean;
  onClose?: () => void;
}

export function BaseModal({ block, visible: controlledVisible, onClose }: BaseModalProps) {
  const [internalVisible, setInternalVisible] = useState(false);
  const { data, modalConfig = {}, styles: blockStyles } = block;

  const visible = controlledVisible !== undefined ? controlledVisible : internalVisible;
  const dismissible = modalConfig.dismissible !== false;
  const fullScreen = modalConfig.fullScreen === true;

  const handleClose = () => {
    if (dismissible) {
      setInternalVisible(false);
      onClose?.();
    }
  };

  // Calculate modal height
  const getModalHeight = () => {
    if (fullScreen) return SCREEN_HEIGHT;
    if (typeof data.height === 'number') return data.height;
    if (typeof data.height === 'string' && data.height.includes('%')) {
      const percent = parseFloat(data.height) / 100;
      return SCREEN_HEIGHT * percent;
    }
    return SCREEN_HEIGHT * 0.8; // Default 80%
  };

  const modalHeight = getModalHeight();

  return (
    <Modal
      visible={visible}
      transparent={!fullScreen}
      animationType="slide"
      onRequestClose={handleClose}
    >
      {!fullScreen && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
      )}
      <View
        style={[
          styles.modalContainer,
          fullScreen ? styles.fullScreen : styles.centered,
          { height: fullScreen ? '100%' : modalHeight },
          blockStyles?.container,
        ]}
      >
        {dismissible && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        )}
        {data.title && (
          <Text style={[styles.title, processFontStyle(blockStyles?.title, Fonts.Black)]}>{data.title}</Text>
        )}
        <ScrollView
          style={styles.content}
          contentContainerStyle={blockStyles?.contentContainer}
        >
          {data.content}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: Colors.backgroundWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  centered: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1000,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.Black,
    padding: 20,
    paddingTop: 60,
  },
  content: {
    flex: 1,
  },
});


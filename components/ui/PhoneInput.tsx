import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  error?: boolean;
}

export function PhoneInput({
  value,
  onChangeText,
  placeholder = 'Enter 10-digit phone number',
  editable = true,
  error = false,
}: PhoneInputProps) {
  return (
    <View style={[styles.wrapper, error && styles.wrapperError]}>
      <Ionicons
        name="call-outline"
        size={20}
        color={Colors.textSecondary}
        style={styles.icon}
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        keyboardType="phone-pad"
        maxLength={10}
        autoFocus={true}
        editable={editable}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          style={styles.clearButton}
        >
          <Ionicons
            name="close-circle"
            size={20}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 25,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    minHeight: 50,
  },
  wrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: Colors.text,
    padding: 0,
    minHeight: 24,
    fontFamily: Fonts.Medium,
  },
  clearButton: {
    marginLeft: 10,
    padding: 4,
  },
});


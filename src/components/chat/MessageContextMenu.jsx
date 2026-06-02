import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

const MessageContextMenu = React.memo(({
  visible,
  canEdit,
  menuAnimation,
  onEdit,
  onDelete,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.menuOverlay}
        activeOpacity={1}
        onPress={onClose}
      />

      <Animated.View
        style={[
          styles.menuContainer,
          {
            opacity: menuAnimation,
            transform: [
              {
                scale: menuAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.menuItem, !canEdit && styles.menuItemDisabled]}
          onPress={onEdit}
          disabled={!canEdit}
        >
          <Ionicons
            name="create-outline"
            size={20}
            color={canEdit ? '#111827' : '#9ca3af'}
          />

          <Text
            style={[styles.menuText, !canEdit && styles.menuTextDisabled]}
          >
            Edit
          </Text>
        </TouchableOpacity>

        <View style={styles.menuDivider} />

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemDanger]}
          onPress={onDelete}
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />

          <Text style={[styles.menuText, styles.menuTextDanger]}>
            Delete
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
});

export default MessageContextMenu;

const styles = StyleSheet.create({
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  menuContainer: {
    position: 'absolute',
    top: 90,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  menuTextDanger: {
    color: '#ef4444',
  },
  menuItemDisabled: {
    opacity: 0.55,
  },
  menuTextDisabled: {
    color: '#9ca3af',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },
});

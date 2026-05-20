import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import notifee from '@notifee/react-native';
import React from 'react';

const Notification = () => {
  const displayNotification = async () => {
    await notifee.requestPermission();

    // Create a channel (required for Android)
    const channelId = await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
    });

    // Display a notification
    await notifee.displayNotification({
      title: 'Notification Title',
      body: 'Main body content of the notification',
      android: {
        channelId,
        // smallIcon: 'name-of-a-small-icon', // optional, defaults to 'ic_launcher'.
        // pressAction is needed if you want the notification to open the app when pressed
        pressAction: {
          id: 'default',
        },
      },
    });
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <TouchableOpacity
        onPress={() => displayNotification()}
        style={{ backgroundColor: 'blue', width: '50%', height: '80%' }}
      >
        <Text style={{ color: 'white' }}>click to get notify</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Notification;

const styles = StyleSheet.create({});

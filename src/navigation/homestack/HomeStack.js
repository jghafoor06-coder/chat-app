import React, { useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid, Alert, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from '../../screens/Home';
import ChatScreen from '../../screens/ChatScreen';
import ProfileScreen from '../../screens/ProfileScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@react-native-vector-icons/ionicons';

import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import messaging from '@react-native-firebase/messaging';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 250,
      }}
    >
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Chatscreen" component={ChatScreen} />
    </Stack.Navigator>
  );
};

const TabNavigation = () => {
  const permissionRequested = useRef(false);
  const uid = auth().currentUser?.uid;

  useEffect(() => {
    const requestNotificationPermission = async () => {
      if (permissionRequested.current || !uid) {
        return;
      }

      permissionRequested.current = true;

      try {
        let granted = false;

        if (Platform.OS === 'android') {
          if (Platform.Version >= 33) {
            const result = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
            granted = result === PermissionsAndroid.RESULTS.GRANTED;
          } else {
            granted = true;
          }
        } else {
          const authStatus = await messaging().requestPermission();
          granted =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        }

        if (!granted) {
          Alert.alert('Permission denied', 'Notifications permission was not granted.');
          return;
        }

        await messaging().registerDeviceForRemoteMessages();
        const token = await messaging().getToken();

        if (token) {
          await database().ref(`/users/${uid}`).update({ fcmToken: token });
        }
      } catch (error) {
        console.log('Notification permission error:', error);
      }
    };

    requestNotificationPermission();
  }, [uid]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        lazy: false,
        tabBarStyle: {
          backgroundColor: 'white',
          paddingBottom: 20,
          height: 90,
          borderTopWidth: 1,
          borderColor: '#eee',
          paddingTop: 5,
          elevation: 0,
        },
        tabBarButton: props => (
          <TouchableOpacity {...props} activeOpacity={0.3} />
        ),
        tabBarHideOnKeyboard: true,
        animation: 'none',
      }}
    >
      <Tab.Screen
        name="Chat"
        component={HomeStack}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'Home';

          const hideOnScreens = ['Chatscreen'];
          return {
            tabBarStyle: {
              display: hideOnScreens.includes(routeName) ? 'none' : 'flex',
              backgroundColor: 'white',
              paddingBottom: 20,
              height: 90,
              borderTopWidth: 1,
              borderColor: '#eee',
              paddingTop: 5,
              elevation: 0,
            },
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'chatbubble' : 'chatbubble-outline'}
                size={30}
                color={color}
              />
            ),
          };
        }}
      />
      <Tab.Screen
        name="Settings"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={25}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigation;

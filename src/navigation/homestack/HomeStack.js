import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from '../../screens/Home';
import ChatScreen from '../../screens/ChatScreen';
import ProfileScreen from '../../screens/ProfileScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@react-native-vector-icons/ionicons';
import { TouchableOpacity } from 'react-native';

import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Chatscreen" component={ChatScreen} />
    </Stack.Navigator>
  );
};

const TabNavigation = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        headerShown: false,
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

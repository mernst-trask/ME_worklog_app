import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import LogWorkScreen from './src/screens/LogWorkScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import WorkersListScreen from './src/screens/WorkersListScreen';
import WorkerDetailScreen from './src/screens/WorkerDetailScreen';
import { colors } from './src/theme';

const TAB_ICONS = {
  LogWork: 'time-outline',
  MyCalendar: 'calendar-outline',
  Team: 'people-outline',
};

const Tab = createBottomTabNavigator();
const TeamStack = createNativeStackNavigator();

function MyCalendar() {
  return <CalendarScreen title="My calendar" />;
}

function TeamStackScreen() {
  return (
    <TeamStack.Navigator>
      <TeamStack.Screen name="WorkersList" component={WorkersListScreen} options={{ title: 'Team' }} />
      <TeamStack.Screen
        name="WorkerDetail"
        component={WorkerDetailScreen}
        options={({ route }) => ({ title: route.params?.name || 'Worker' })}
      />
    </TeamStack.Navigator>
  );
}

function LogoutHeaderButton() {
  const { logout } = useAuth();
  return (
    <TouchableOpacity onPress={logout} style={{ paddingHorizontal: 12 }}>
      <Text style={{ color: colors.rose, fontWeight: '600' }}>Log out</Text>
    </TouchableOpacity>
  );
}

function MainTabs() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => <LogoutHeaderButton />,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size, focused }) => {
          const baseName = TAB_ICONS[route.name] || 'ellipse-outline';
          const name = focused ? baseName.replace('-outline', '') : baseName;
          return <Ionicons name={name} color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="LogWork" component={LogWorkScreen} options={{ title: 'Log Work' }} />
      <Tab.Screen name="MyCalendar" component={MyCalendar} options={{ title: 'Calendar' }} />
      {isManager && (
        <Tab.Screen
          name="Team"
          component={TeamStackScreen}
          options={{ title: 'Team', headerShown: false }}
        />
      )}
    </Tab.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      {user ? <MainTabs /> : <LoginScreen />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
});
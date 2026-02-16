import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import axios, { AxiosInstance } from 'axios';

export function useApi(): AxiosInstance {
  const { data: session } = useSession();

  const apiClient = useMemo(() => {
    const instance = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    instance.interceptors.request.use((config) => {
      if (session?.accessToken) {
        config.headers.Authorization = `Bearer ${session.accessToken}`;
      }
      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, [session?.accessToken]);

  return apiClient;
}

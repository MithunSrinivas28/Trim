import { useState, useEffect } from "react";

export const useRecommendation = (containerId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchRecommendation = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `http://localhost:3001/api/containers/${containerId}/recommend`
        );
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendation();
    const interval = setInterval(fetchRecommendation, 30000);
    return () => clearInterval(interval);
  }, [containerId]);

  return { data, loading, error };
};

import { useState, useEffect } from "react";

export const useAgent = (containerId) => {
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerId) {
      setRecommendation(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchAgent = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `http://localhost:8000/agent/${containerId}`
        );
        const json = await res.json();
        setRecommendation(json.recommendation || null);
      } catch (err) {
        setError(err.message);
        setRecommendation(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [containerId]);

  return { recommendation, loading, error };
};

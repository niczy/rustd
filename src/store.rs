use chrono::NaiveDate;
use rusqlite::{Connection, Result as SqliteResult, params};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HitResult {
    pub state: String,
    pub hit: i32,
    pub date: String, // YYYY-MM-DD format
    pub timestamp: Option<String>, // ISO 8601 timestamp format
}

pub struct SqliteStore {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteStore {
    pub fn new(db_path: &str) -> SqliteResult<Self> {
        let conn = Connection::open(db_path)?;
        
        // Create table if it doesn't exist
        conn.execute(
            "CREATE TABLE IF NOT EXISTS hits (
                date TEXT NOT NULL,
                state TEXT NOT NULL,
                hit INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Create indexes for common query patterns
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_hits_date_state ON hits(date, state)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_hits_timestamp ON hits(timestamp)",
            [],
        )?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub async fn add_hit(&self, hit: &HitResult) -> SqliteResult<()> {
        let conn = self.conn.lock().await;
        match &hit.timestamp {
            Some(ts) => {
                // Validate timestamp format (ISO 8601)
                if !ts.starts_with(&hit.date) {
                    return Err(rusqlite::Error::InvalidParameterName(
                        format!("Timestamp must start with the hit date. Got timestamp '{}' but date is '{}'", 
                            ts, hit.date).into()
                    ));
                }
                // Verify it parses as valid ISO 8601
                if let Err(e) = chrono::DateTime::parse_from_rfc3339(ts) {
                    return Err(rusqlite::Error::InvalidParameterName(
                        format!("Timestamp must be valid ISO 8601/RFC 3339 format: {}", e).into()
                    ));
                }
                conn.execute(
                    "INSERT INTO hits (date, state, hit, timestamp) VALUES (?1, ?2, ?3, ?4)",
                    params![hit.date, hit.state, hit.hit, ts],
                )?;
            },
            None => {
                conn.execute(
                    "INSERT INTO hits (date, state, hit) VALUES (?1, ?2, ?3)",
                    params![hit.date, hit.state, hit.hit],
                )?;
            }
        }
        Ok(())
    }

    pub async fn get_all_hit_results(&self) -> SqliteResult<Vec<HitResult>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT state, hit, date, timestamp FROM hits ORDER BY date"
        )?;

        let hits = stmt.query_map([], |row| {
            Ok(HitResult {
                state: row.get(0)?,
                hit: row.get(1)?,
                date: row.get(2)?,
                timestamp: row.get(3)?,
            })
        })?;

        let mut results = Vec::new();
        for hit in hits {
            results.push(hit?);
        }
        
        Ok(results)
    }

    pub async fn get_hits_in_range(&self, start_date: NaiveDate, end_date: NaiveDate) -> SqliteResult<Vec<HitResult>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "WITH LatestHits AS (
                SELECT *,
                    ROW_NUMBER() OVER (PARTITION BY date, state ORDER BY timestamp DESC) as rn
                FROM hits
                WHERE date >= ?1 AND date <= ?2
            )
            SELECT state, hit, date, timestamp
            FROM LatestHits 
            WHERE rn = 1
            ORDER BY date"
        )?;

        let hits = stmt.query_map(
            params![start_date.to_string(), end_date.to_string()],
            |row| {
                Ok(HitResult {
                    state: row.get(0)?,
                    hit: row.get(1)?,
                    date: row.get(2)?,
                    timestamp: row.get(3)?,
                })
            },
        )?;

        let mut results = Vec::new();
        for hit in hits {
            results.push(hit?);
        }
        
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    #[tokio::test]
    async fn test_add_and_get_hits() {
        let store = SqliteStore::new(":memory:").unwrap();
        
        let date = NaiveDate::from_ymd_opt(2023, 1, 1).unwrap();
        
        // Add first hit for CA
        let hit1 = HitResult {
            state: "CA".to_string(),
            hit: 1,
            date: date.to_string(),
            timestamp: Some("2023-01-01T10:00:00".to_string()),
        };
        store.add_hit(&hit1).await.unwrap();

        // Add second hit for CA with higher value
        let hit2 = HitResult {
            state: "CA".to_string(), 
            hit: 5,
            date: date.to_string(),
            timestamp: Some("2023-01-01T11:00:00".to_string()),
        };
        store.add_hit(&hit2).await.unwrap();

        // Add hit for NY on same date
        let hit3 = HitResult {
            state: "NY".to_string(),
            hit: 3,
            date: date.to_string(),
            timestamp: Some("2023-01-01T12:00:00".to_string()),
        };
        store.add_hit(&hit3).await.unwrap();

        let start_date = NaiveDate::from_ymd_opt(2023, 1, 1).unwrap();
        let end_date = NaiveDate::from_ymd_opt(2023, 12, 31).unwrap();
        
        let all_results = store.get_all_hit_results().await.unwrap();
        assert_eq!(all_results.len(), 3);

        let results = store.get_hits_in_range(start_date, end_date).await.unwrap();
        println!("Results from get_hits_in_range:");
        for result in &results {
            println!("  State: {}, Hit: {}, Date: {}", result.state, result.hit, result.date);
        }

        // Should only return latest hit per state per date
        assert_eq!(results.len(), 2);
        
        // Results should be ordered by date
        assert_eq!(results[0].state, "CA");
        assert_eq!(results[0].hit, 5); // Latest CA hit
        assert_eq!(results[0].date, "2023-01-01");

        assert_eq!(results[1].state, "NY"); 
        assert_eq!(results[1].hit, 3);
        assert_eq!(results[1].date, "2023-01-01");
    }

    #[tokio::test]
    async fn test_get_all_hit_results() {
        let store = SqliteStore::new(":memory:").unwrap();
        
        let date = NaiveDate::from_ymd_opt(2023, 1, 1).unwrap();
        
        // Add first hit
        let hit1 = HitResult {
            state: "CA".to_string(),
            hit: 1,
            date: date.to_string(),
            timestamp: None,
        };
        store.add_hit(&hit1).await.unwrap();

        // Add second hit
        let hit2 = HitResult {
            state: "NY".to_string(),
            hit: 3, 
            date: date.to_string(),
            timestamp: None,
        };
        store.add_hit(&hit2).await.unwrap();

        let results = store.get_all_hit_results().await.unwrap();
        
        assert_eq!(results.len(), 2);
        
        // Results should be ordered by date and state
        assert_eq!(results[0].state, "CA");
        assert_eq!(results[0].hit, 1);
        assert_eq!(results[0].date, "2023-01-01");

        assert_eq!(results[1].state, "NY");
        assert_eq!(results[1].hit, 3);
        assert_eq!(results[1].date, "2023-01-01");
    }

    #[tokio::test]
    async fn test_get_hits_empty_range() {
        let store = SqliteStore::new(":memory:").unwrap();
        
        let start_date = NaiveDate::from_ymd_opt(2023, 1, 1).unwrap();
        let end_date = NaiveDate::from_ymd_opt(2023, 12, 31).unwrap();
        
        let results = store.get_hits_in_range(start_date, end_date).await.unwrap();
        assert!(results.is_empty());
    }
}

mod store;

use axum::{
    routing::{get, post},
    Router,
    extract::{Query, State, TypedHeader},
    headers::{Authorization, authorization::Bearer},
    Json,
    http::StatusCode,
};
use chrono::NaiveDate;
use serde::Deserialize;
use std::sync::Arc;
use store::{SqliteStore, HitResult};
use std::env;
use std::collections::HashMap;
use serde::Serialize;

#[derive(Debug, Deserialize)]
struct DateRange {
    #[serde(rename = "start-date")]
    start_date: NaiveDate,
    #[serde(rename = "end-date")]
    end_date: NaiveDate,
}

#[derive(Debug, Serialize)]
struct AggregatedResult {
    date: String,
    total_hits: i32,
    by_states: HashMap<String, i32>,
}

#[derive(Clone)]
struct AppState {
    store: Arc<SqliteStore>,
    access_token: String,
}

#[tokio::main]
async fn main() {
    let mut args = env::args().skip(1);
    let mut db_path = None;
    let mut access_token = None;

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--db" => {
                db_path = args.next();
            }
            "--access_token" => {
                access_token = args.next();
            }
            _ => {
                eprintln!("Usage: {} --db <database_path> --access_token <token>", env::args().next().unwrap());
                std::process::exit(1);
            }
        }
    }

    let db_path = db_path.unwrap_or_else(|| {
        eprintln!("Usage: {} --db <database_path> --access_token <token>", env::args().next().unwrap());
        std::process::exit(1);
    });

    let access_token = access_token.unwrap_or_else(|| {
        eprintln!("Usage: {} --db <database_path> --access_token <token>", env::args().next().unwrap());
        std::process::exit(1);
    });

    let store = SqliteStore::new(&db_path).expect("Failed to create database");
    let state = AppState {
        store: Arc::new(store),
        access_token,
    };
    
    let app = Router::new()
        .route("/hits", get(get_hits))
        .route("/add_result", post(add_result))
        .with_state(state);

    println!("Server running on http://localhost:3000");
    
    axum::Server::bind(&"0.0.0.0:3000".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn verify_token(auth: Option<TypedHeader<Authorization<Bearer>>>, token: &str) -> Result<(), (StatusCode, &'static str)> {
    match auth {
        Some(auth) if auth.token() == token => Ok(()),
        _ => Err((StatusCode::UNAUTHORIZED, "Invalid or missing access token")),
    }
}

async fn get_hits(
    Query(range): Query<DateRange>,
    State(state): State<AppState>,
) -> Json<Vec<AggregatedResult>> {
    let results = state.store
        .get_hits_in_range(range.start_date, range.end_date)
        .await
        .expect("Failed to get hits");
    
    let mut aggregated: HashMap<String, AggregatedResult> = HashMap::new();
    
    for hit in results {
        let entry = aggregated.entry(hit.date.clone()).or_insert_with(|| AggregatedResult {
            date: hit.date.clone(),
            total_hits: 0,
            by_states: HashMap::new(),
        });
        
        entry.total_hits += hit.hit;
        *entry.by_states.entry(hit.state).or_insert(0) += hit.hit;
    }
    
    let mut result: Vec<AggregatedResult> = aggregated.into_values().collect();
    result.sort_by(|a, b| a.date.cmp(&b.date));
    
    Json(result)
}

async fn add_result(
    auth: Option<TypedHeader<Authorization<Bearer>>>,
    State(state): State<AppState>,
    Json(hit): Json<HitResult>,
) -> Result<Json<HitResult>, (StatusCode, &'static str)> {
    verify_token(auth, &state.access_token).await?;

    state.store
        .add_hit(&hit)
        .await
        .expect("Failed to add hit");
    Ok(Json(hit))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use reqwest;
    #[tokio::test]
    async fn test_add_result_endpoint() {
        // Create test hit data for multiple dates and states
        let dates = vec![
            chrono::Local::now().date_naive(),
            chrono::Local::now().date_naive() - chrono::Duration::days(1),
            chrono::Local::now().date_naive() - chrono::Duration::days(2),
        ];

        let states = vec![
            ("CA", 42),
            ("NY", 27),
            ("TX", 35),
            ("FL", 31),
        ];

        for date in dates {
            for (state, hit_count) in &states {
                let hit = HitResult {
                    state: state.to_string(),
                    hit: *hit_count,
                    date: date.to_string(),
                    timestamp: Some(format!("{}T12:00:00Z", date.format("%Y-%m-%d"))),
                };

                println!("Test hit data: {:?}", hit);

                // Send request to local server
                let client = reqwest::Client::new();
                let response = client
                    .post("http://localhost:3000/add_result")
                    .header("Authorization", "Bearer test_token")
                    .json(&hit)
                    .send()
                    .await
                    .unwrap();

                assert_eq!(response.status(), StatusCode::OK);

                // Parse response body
                let response_hit: HitResult = response.json().await.unwrap();

                assert_eq!(response_hit.state, hit.state);
                assert_eq!(response_hit.hit, hit.hit);
                assert_eq!(response_hit.date, hit.date);
            }
        }
    }
}

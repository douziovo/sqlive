package com.douzi.sqlive.service.database;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

@Component
@Slf4j
public class DatabasePoolManager {

    private static final int MAX_DATABASES = 20;
    private static final String DB_NAME_PATTERN = "^[a-zA-Z0-9_-]{1,64}$";

    private final Map<String, JdbcTemplate> jdbcTemplates = new ConcurrentHashMap<>();
    private final Lock evictionLock = new ReentrantLock();

    @PreDestroy
    public void cleanup() {
        for (var entry : jdbcTemplates.entrySet()) {
            try {
                JdbcTemplate jdbc = entry.getValue();
                jdbc.execute("PRAGMA foreign_keys = OFF");
                var ds = jdbc.getDataSource();
                if (ds instanceof HikariDataSource hds) {
                    hds.close();
                }
                log.info("Closed database '{}'", entry.getKey());
            } catch (Exception e) {
                log.warn("Failed to clean up database '{}'", entry.getKey(), e);
            }
        }
        jdbcTemplates.clear();
    }

    public JdbcTemplate getOrCreateJdbcTemplate(String dbName) {
        if (dbName == null || !dbName.matches(DB_NAME_PATTERN)) {
            throw new IllegalArgumentException("Invalid dbName: " + dbName);
        }
        JdbcTemplate existing = jdbcTemplates.get(dbName);
        if (existing != null) {
            return existing;
        }
        evictionLock.lock();
        try {
            existing = jdbcTemplates.get(dbName);
            if (existing != null) {
                return existing;
            }
            if (jdbcTemplates.size() >= MAX_DATABASES) {
                var it = jdbcTemplates.entrySet().iterator();
                if (it.hasNext()) {
                    var entry = it.next();
                    jdbcTemplates.remove(entry.getKey());
                    closeDataSource(entry.getValue());
                    log.info("Evicted database '{}' (max={})", entry.getKey(), MAX_DATABASES);
                }
            }
            JdbcTemplate jt = createJdbcTemplate(dbName);
            jdbcTemplates.put(dbName, jt);
            return jt;
        } finally {
            evictionLock.unlock();
        }
    }

    private void closeDataSource(JdbcTemplate jdbc) {
        try {
            var ds = jdbc.getDataSource();
            if (ds instanceof HikariDataSource hds) {
                hds.close();
            }
        } catch (Exception e) {
            log.warn("Failed to close DataSource", e);
        }
    }

    private JdbcTemplate createJdbcTemplate(String name) {
        String url = "jdbc:sqlite:file:" + name + "?mode=memory";
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setMaximumPoolSize(1);
        config.setPoolName("SQLitePool-" + name);
        log.info("Created DataSource for database '{}'", name);
        return new JdbcTemplate(new HikariDataSource(config));
    }

    int getPoolSize() {
        return jdbcTemplates.size();
    }
}

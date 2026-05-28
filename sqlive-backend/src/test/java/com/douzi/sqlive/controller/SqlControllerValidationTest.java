package com.douzi.sqlive.controller;

import com.douzi.sqlive.dto.SqlRequest;
import com.douzi.sqlive.dto.SqlResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SqlControllerValidationTest {

    @Value("${local.server.port}")
    private int port;

    private final RestTemplate restTemplate = new RestTemplate();

    private String url() {
        return SqlControllerTestSupport.url(port);
    }

    private ResponseEntity<SqlResponse> post(SqlRequest req) {
        return SqlControllerTestSupport.postForEntity(restTemplate, port, req);
    }

    @Test
    void shouldRejectNullSql() {
        SqlRequest req = new SqlRequest();
        req.setSql(null);

        ResponseEntity<SqlResponse> resp = post(req);
        assertNotNull(resp.getBody());
        assertFalse(resp.getBody().isSuccess());
        assertTrue(resp.getBody().getError().getMessage().contains("SQL cannot be empty"));
    }

    @Test
    void shouldRejectEmptySql() {
        SqlRequest req = new SqlRequest();
        req.setSql("");

        ResponseEntity<SqlResponse> resp = post(req);
        assertNotNull(resp.getBody());
        assertFalse(resp.getBody().isSuccess());
        assertTrue(resp.getBody().getError().getMessage().contains("SQL cannot be empty"));
    }

    @Test
    void shouldRejectBlankSql() {
        SqlRequest req = new SqlRequest();
        req.setSql("   \n\t   ");

        ResponseEntity<SqlResponse> resp = post(req);
        assertNotNull(resp.getBody());
        assertFalse(resp.getBody().isSuccess());
        assertTrue(resp.getBody().getError().getMessage().contains("SQL cannot be empty"));
    }

    @Test
    void shouldAcceptValidSql() {
        SqlRequest req = new SqlRequest();
        req.setSql("SELECT 1;");
        req.setDbName("validation_test");
        req.setReset(true);

        ResponseEntity<SqlResponse> resp = post(req);
        assertNotNull(resp.getBody());
        assertTrue(resp.getBody().isSuccess());
    }
}

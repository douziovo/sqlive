package com.douzi.sqlive.controller;

import com.douzi.sqlive.dto.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SqlControllerTest {

    @Value("${local.server.port}")
    private int port;

    private final RestTemplate restTemplate = new RestTemplate();

    private String url() {
        return "http://localhost:" + port + "/api/execute";
    }

    private SqlResponse post(SqlRequest req) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<SqlRequest> entity = new HttpEntity<>(req, headers);
        try {
            ResponseEntity<SqlResponse> resp = restTemplate.exchange(url(), HttpMethod.POST, entity, SqlResponse.class);
            return resp.getBody();
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            return e.getResponseBodyAs(SqlResponse.class);
        }
    }

    @Test
    void shouldExecuteSimpleSql() {
        SqlRequest req = new SqlRequest();
        req.setSql("CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1); SELECT * FROM t;");
        req.setDbName("controller_test");
        req.setReset(true);

        SqlResponse body = post(req);
        assertNotNull(body);
        assertTrue(body.isSuccess());
        assertEquals(1, body.getData().getTables().size());
        assertEquals("t", body.getData().getTables().getFirst().getName());
        assertEquals(1, body.getData().getQueryResults().size());
    }

    @Test
    void shouldReturnErrorForInvalidSql() {
        SqlRequest req = new SqlRequest();
        req.setSql("NOT VALID SQL;");
        req.setDbName("error_ctrl_test");
        req.setReset(true);

        SqlResponse body = post(req);
        assertNotNull(body);
        assertFalse(body.isSuccess());
        assertNotNull(body.getError());
        assertNotNull(body.getError().getMessage());
    }

    @Test
    void shouldRejectEmptyScript() {
        SqlRequest req = new SqlRequest();
        req.setSql("");
        req.setDbName("empty_ctrl_test");
        req.setReset(true);

        SqlResponse body = post(req);
        assertNotNull(body);
        assertFalse(body.isSuccess());
        assertNotNull(body.getError());
        assertTrue(body.getError().getMessage().contains("SQL cannot be empty"));
    }

    @Test
    void shouldIsolateDatabasesByName() {
        SqlRequest req1 = new SqlRequest();
        req1.setSql("CREATE TABLE a (x INTEGER); INSERT INTO a VALUES (1);");
        req1.setDbName("iso_a_ctrl");
        req1.setReset(true);

        SqlRequest req2 = new SqlRequest();
        req2.setSql("CREATE TABLE b (y TEXT); INSERT INTO b VALUES ('hello');");
        req2.setDbName("iso_b_ctrl");
        req2.setReset(true);

        post(req1);
        post(req2);

        SqlRequest checkA = new SqlRequest();
        checkA.setSql("SELECT name FROM sqlite_master WHERE type='table';");
        checkA.setDbName("iso_a_ctrl");
        checkA.setReset(false);

        SqlResponse respA = post(checkA);
        assertTrue(respA.isSuccess());
        assertEquals(1, respA.getData().getTables().size());
        assertEquals("a", respA.getData().getTables().getFirst().getName());
    }

    @Test
    void shouldReportMetadata() {
        SqlRequest req = new SqlRequest();
        req.setSql("CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);");
        req.setDbName("meta_ctrl_test");
        req.setReset(true);

        SqlResponse body = post(req);
        assertNotNull(body);
        assertTrue(body.isSuccess());
        assertNotNull(body.getData().getMetadata());
        assertTrue(body.getData().getMetadata().getDurationMs() >= 0);
        assertTrue(body.getData().getMetadata().getStatementCount() >= 2);
    }
}

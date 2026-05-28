package com.douzi.sqlive.controller;

import com.douzi.sqlive.dto.SqlRequest;
import com.douzi.sqlive.dto.SqlResponse;
import org.springframework.http.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

public final class SqlControllerTestSupport {

    private SqlControllerTestSupport() {
        // utility class
    }

    public static String url(int port) {
        return "http://localhost:" + port + "/api/execute";
    }

    public static HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    public static SqlResponse postForBody(RestTemplate restTemplate, int port, SqlRequest req) {
        HttpEntity<SqlRequest> entity = new HttpEntity<>(req, jsonHeaders());
        try {
            ResponseEntity<SqlResponse> resp = restTemplate.exchange(
                    url(port), HttpMethod.POST, entity, SqlResponse.class);
            return resp.getBody();
        } catch (HttpClientErrorException e) {
            return e.getResponseBodyAs(SqlResponse.class);
        }
    }

    public static ResponseEntity<SqlResponse> postForEntity(RestTemplate restTemplate, int port, SqlRequest req) {
        HttpEntity<SqlRequest> entity = new HttpEntity<>(req, jsonHeaders());
        try {
            return restTemplate.exchange(
                    url(port), HttpMethod.POST, entity, SqlResponse.class);
        } catch (HttpClientErrorException e) {
            SqlResponse body = e.getResponseBodyAs(SqlResponse.class);
            return new ResponseEntity<>(body, e.getResponseHeaders(), e.getStatusCode());
        }
    }
}

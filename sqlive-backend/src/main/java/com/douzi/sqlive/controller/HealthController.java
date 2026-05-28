package com.douzi.sqlive.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/health")
    @SuppressWarnings("SameReturnValue")
    public String health() {
        return "OK";
    }
}

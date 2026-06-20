package com.douzi.sqlive.exception;

public class PoolFullException extends RuntimeException {
    private final int maxDatabases;

    public PoolFullException(String message, int maxDatabases) {
        super(message);
        this.maxDatabases = maxDatabases;
    }

    public PoolFullException(String message, Throwable cause, int maxDatabases) {
        super(message, cause);
        this.maxDatabases = maxDatabases;
    }

    public int getMaxDatabases() {
        return this.maxDatabases;
    }
}

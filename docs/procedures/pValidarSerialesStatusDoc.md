# SP: pValidarSerialesStatusDoc
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saSeriales`](../tables/saSeriales.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarSerialesStatusDoc]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @DocNum AS CHAR(20)
        DECLARE @SerialesEstatus AS INT
        DECLARE @TotalArt AS DECIMAL(18, 5)
        DECLARE @TotalArtSeriales AS DECIMAL(18, 5)

        DECLARE @i INT
        SET @i = 1

        WHILE @i <= 2 
            BEGIN
                IF ( @i = 1 ) 
                    BEGIN
                        DECLARE CURSOR_VALIDAR CURSOR LOCAL FAST_FORWARD
                        FOR
                            SELECT
                                A.rowguid, A.ajue_num AS doc_num, A.seriales_e AS SerialesStatus, A.TotalArticulos,
                                A.TotalSeriales
                            FROM
                                ( SELECT
                                    E.rowguid, E.ajue_num, E.seriales_e,
                                    SUM([dbo].[ArtUnidadBase](R.co_art, R.co_uni, R.total_Art)) AS TotalArticulos,
                                    ( SELECT
                                        COUNT(*)
                                      FROM
                                        saSeriales SI
                                      WHERE
                                        SI.serial IS NOT NULL
                                        AND SI.doc_tip_e = 'AJUS'
                                        AND SI.doc_num_e IN ( SELECT
                                                                RI.rowguid
                                                              FROM
                                                                saAjusteReng RI
                                                                INNER JOIN saAjuste EI ON RI.ajue_num = EI.ajue_num
                                                                                          AND EI.ajue_num = E.ajue_num )
                                    ) AS TotalSeriales
                                  FROM
                                    saAjuste E
                                    INNER JOIN saAjusteReng R ON E.ajue_num = R.ajue_num
                                    INNER JOIN saTipoAjuste TA ON TA.co_tipo = R.co_tipo
```

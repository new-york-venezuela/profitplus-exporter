# SP: RepResumenDocumentoCXC
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03-08-10>
-- Description:	<Resumen de Documentos de Venta>
-- =============================================
CREATE PROCEDURE [RepResumenDocumentoCXC]
    @dFecha_Emis_d DATETIME = NULL ,
    @dFecha_Emis_h DATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @dFecha_Emis_d IS NOT NULL 
            SET @dFecha_Emis_d = dbo.FechaSimple(@dFecha_Emis_d)
        IF @dFecha_Emis_h IS NOT NULL 
            SET @dFecha_Emis_h = dbo.FechaSimple(@dFecha_Emis_h)

        SELECT
            DC.co_tipo_doc, SUM(DC.total_neto) AS monto
        FROM
            saDocumentoVenta AS DC
            INNER JOIN saCliente AS P ON P.co_cli = DC.co_cli
        WHERE
            ( ( @dFecha_Emis_d IS NULL
                OR dbo.FechaSimple(DC.fec_emis) >= @dFecha_Emis_d
              )
              AND ( @dFecha_Emis_h IS NULL
                    OR dbo.FechaSimple(DC.fec_emis) <= @dFecha_Emis_h
                  )
            )
            AND ( @sCo_Cli_d IS NULL
                  OR DC.co_cli >= @sCo_Cli_d
                )
            AND ( @sCo_Cli_h IS NULL
                  OR DC.co_cli <= @sCo_Cli_h
                )
            AND ( @sCo_Moneda IS NULL
                  OR DC.co_mone = @sCo_Moneda
                )
            AND ( @sCo_Sucursal IS NULL
                  OR DC.co_sucu_in = @sCo_Sucursal
                )
            AND ( DC.anulado = 0 )
            AND DC.co_tipo_doc IN ( 'FACT', 'N/CR', 'N/DB', 'CHEQ', 'ISLR', 'ADEL', 'GIRO', 'CFXG', 'IVAN', 'IVAP' )
        GROUP BY
            DC.co_tipo_doc
        UNION
        SELECT
            'AJPO', SUM(DC.total_neto) AS monto
        FROM
            saDocumentoVenta AS DC
            INNER JOIN saCliente AS P ON P.co_cli = DC.co_cli
        WHERE
            ( ( @dFecha_Emis_d IS NULL
                OR dbo.FechaSimple(DC.fec_emis) >= @dFecha_Emis_d
              )
              AND ( @dFecha_Emis_h IS NULL
                    OR dbo.FechaSimple(DC.fec_emis) <= @dFecha_Emis_h
                  )
            )
            AND ( @sCo_Cli_d IS NULL
                  OR DC.co_Cli >= @sCo_Cli_d
```

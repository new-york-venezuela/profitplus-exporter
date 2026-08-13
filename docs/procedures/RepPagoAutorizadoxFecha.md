# SP: RepPagoAutorizadoxFecha
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03-08-10>
-- Description:	<Pagos Autorizados por Fecha>
-- =============================================
CREATE PROCEDURE [dbo].[RepPagoAutorizadoxFecha]
    @sNum_doc_d CHAR(20) = NULL ,
    @sNum_doc_h CHAR(20) = NULL ,
    @dFecha_Emis_d SMALLDATETIME = NULL ,
    @dFecha_Emis_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'nro_doc'

        IF @dFecha_Emis_h IS NOT NULL 
            SET @dFecha_Emis_h = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_Emis_h))

        SELECT
            DC.*, P.prov_des, TP.descrip, TP.tipo_mov
        FROM
            saDocumentoCompra AS DC
            INNER JOIN saProveedor AS P ON P.co_prov = DC.co_prov
            LEFT JOIN saTipoDocumento AS TP ON TP.co_tipo_doc = DC.co_tipo_doc
        WHERE
            ( ( @sNum_doc_d IS NULL
                OR DC.nro_doc >= @sNum_doc_d
              )
              AND ( @sNum_doc_h IS NULL
                    OR DC.nro_doc <= @sNum_doc_h
                  )
            )
            AND ( ( @sCo_Prov_d IS NULL
                    OR DC.co_prov >= @sCo_Prov_d
                  )
                  AND ( @sCo_Prov_h IS NULL
                        OR DC.co_prov <= @sCo_Prov_h
                      )
                )
            AND ( @dFecha_Emis_d IS NULL
                  OR DC.fec_emis >= @dFecha_Emis_d
                )
            AND ( @dFecha_Emis_h IS NULL
                  OR DC.fec_emis <= @dFecha_Emis_h
                )
            AND ( @sCo_Sucursal IS NULL
                  OR DC.co_sucu_in = @sCo_Sucursal
                )
            AND ( DC.pagar = 1 )
       ORDER BY
            dbo.FechaSimple(DC.fec_emis),
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'nro_doc' THEN DC.nro_doc
                               END
            END DESC, 
            
            CASE @sDir
               WHEN 'ASC' THEN CASE @sCampOrderBy
                                  WHEN 'nro_doc' THEN DC.nro_doc
```

# SP: RepPagoProgramadosxProveedor
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <20-05-11>
-- Description:	<Pagos Programados por Proveedor>
-- =============================================
CREATE PROCEDURE [RepPagoProgramadosxProveedor]
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


DECLARE @temp_documento TABLE
            (
              [Nro_doc ] [char](10) ,
              [co_tipo_doc] [char](6),
              [Co_prov] [char](6),
              [Prov_des] [char](30),
              [Fec_emis] [DATETIME],
              [Fec_venc] [DATETIME],
              [Total_Neto] [DECIMAL](18,2),
			  [saldo] [DECIMAL](18,2),
			  [Monto_pago] [DECIMAL](18,2),
			  [Fecha_pago] [DATETIME]				 
            )


DECLARE @pNro_doc AS CHAR(10),
@pco_tipo_doc AS CHAR(6),
@pCo_prov AS CHAR(6),
@pProv_des AS CHAR(30),
@pFec_emis AS datetime,
@pFec_venc AS datetime,
@pTotal_Neto as DECIMAL (18,2),
@pSaldo AS DECIMAL (18,2)


DECLARE @pMonto_pago AS DECIMAL (18,2),
@pFecha_pago AS DATETIME


DECLARE CURSOR_DOCUMENTOS CURSOR LOCAL FAST_FORWARD
FOR
SELECT  
DC.nro_doc,
DC.co_tipo_doc,
DC.co_prov,
P.prov_des,
DC.fec_emis,
DC.fec_venc,
DC.total_neto,
DC.saldo
FROM saDocumentoCompra AS DC
INNER JOIN saProveedor AS P ON DC.co_prov = P.co_prov AND DC.anulado = 0
WHERE DC.pro_pago IS NOT NULL  AND
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

            AND ( @sCo_Sucursal IS NULL
                  OR DC.co_sucu_in = @sCo_Sucursal
                )

OPEN CURSOR_DOCUMENTOS

FETCH NEXT FROM CURSOR_DOCUMENTOS INTO @pNro_doc,
@pco_tipo_doc,
@pCo_prov,
@pProv_des,
@pFec_emis,
@pFec_venc,
@pTotal_Neto,
@pSaldo


WHILE @@FETCH_STA
```

# SP: RepFormatoGiroVenta
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02/24/2011>
-- Description:	<Reporte de Formato de Giros de Ventas>
-- =============================================
CREATE PROCEDURE [RepFormatoGiroVenta] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_Tip_d CHAR(6) = NULL ,
    @sCo_Tip_h CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            CL.cli_des, DV.nro_doc, DV.fec_emis, ROUND(DV.total_neto, 2) AS total_neto, DAY(DV.fec_emis) AS dia,
            MONTH(DV.fec_emis) AS mes, YEAR(DV.fec_emis) AS año, DV.observa,
            dbo.MontoEscrito(ROUND(DV.total_neto, 2)) AS monto_escrito
        FROM
            saCliente AS CL
            INNER JOIN saDocumentoVenta DV ON ( ( CL.co_cli = DV.co_cli )
                                                AND ( DV.co_tipo_doc = 'GIRO' )
                                              )
        WHERE
            ( ( @cCo_Numero_d IS NULL
                OR DV.nro_doc >= @cCo_Numero_d
              )
              AND ( @cCo_Numero_h IS NULL
                    OR DV.nro_doc <= @cCo_Numero_h
                  )
             AND ( @sCo_Tip_d IS NULL
                  OR DV.co_tipo_doc = @sCo_Tip_d
                )        
            AND ( @sCo_Tip_h IS NULL
                  OR DV.co_tipo_doc = @sCo_Tip_h
            )
            AND ( @cCo_Sucursal IS NULL
                  OR @cCo_Sucursal = DV.co_sucu_in
                )
             )	

    END
```

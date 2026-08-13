# SP: RepRelacionDeISLRRetenidoPorProveedorYConcepto
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saConISLR`](../tables/saConISLR.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRentenReng`](../tables/saPagoRentenReng.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <10-26-2010>
-- Description:   <Relación de ISLR Retenido por Proveedor y Concepto>
-- =============================================
CREATE PROCEDURE [dbo].[RepRelacionDeISLRRetenidoPorProveedorYConcepto]
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
     @sCo_Bene_d CHAR(10) = NULL ,
    @sCo_Bene_h CHAR(10) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
        
         DECLARE @tipo BIT
        SET @tipo = 0
        
        IF (((@sCo_Prov_d IS NOT NULL) OR (@sCo_Prov_h IS NOT NULL)) AND ((@sCo_Bene_d IS NOT NULL) OR (@sCo_Bene_h IS NOT NULL)))   
        BEGIN
			RAISERROR('No es posible ejecutar el reporte para proveedor y beneficiario a la vez.',16,1)
			RETURN
		END
		
		IF((@sCo_Prov_d IS NOT NULL) OR (@sCo_Prov_h IS NOT NULL) OR
		  (((@sCo_Prov_d IS NULL) AND (@sCo_Prov_h IS NULL)) AND ((@sCo_Bene_d IS NULL) AND (@sCo_Bene_h IS NULL))))
		BEGIN
			SET @tipo = 1
		END
      
        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d) 
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)
            
            IF (@tipo = 1)
            BEGIN 
    
				SELECT
					P.rif, P.co_prov, P.prov_des, SUM(PR.monto_obj) AS monto_obj, SUM(PR.monto_reten) AS monto_reten, PR.co_islr,
					C.islr_des,'tipo' = @tipo
				FROM
					saProveedor P
					INNER JOIN saPago PA ON P.co_prov = PA.co_prov
					--INNER JOIN saPagoTPReng PT ON PT.cob_num = PA.cob_num
					INNER JOIN saPagoDocReng PD ON PD.cob_num = PA.cob_num
												   AND PD.co_tipo_doc = 'ISLR'
					INNER JOIN saPagoRentenReng PR ON PD.rowguid = PR.rowguid_reng_cob
					LEFT JOIN saConIslr C ON PR.co_islr = C.co_islr
				WHERE
					( ( @dFecha_d IS NULL
						OR dbo.FechaSimple(PA.fecha) >= @dFecha_d
					  )
					  AND ( @dFecha_h IS NULL
							OR dbo.FechaSimple(PA.fecha) <= @dFecha_h
						  )
					  )
					  AND ( ( @sCo_Prov_d IS NULL
							OR PA.co_prov >= @sCo_Prov_d
						)
						AND ( @sCo_Prov_h IS NULL
								OR PA.co_prov <= @sCo_Prov_h
							)
						)
					AND ( PA.anulado = 0 )
				GROUP BY
					P.co_prov, P.rif, P.prov_des, PR.co_islr, C.islr_des
				ORDER BY
```
